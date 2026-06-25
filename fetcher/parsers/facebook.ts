import { chromium } from "playwright";
import { pb } from "../pb.js";

interface FeedRecord {
  id: string;
  name: string;
  url: string;
}

// Strip Facebook UI chrome (timestamps, reaction buttons, share labels) from scraped text
function cleanFacebookText(text: string): string {
  return text
    .replace(/^\s*\d+\s*[umhdw]\b\s*·?\s*/i, "")        // leading timestamps "3 u ·"
    .replace(/·\s*Gedeeld met\b[^·\n]*/gi, "")            // "· Gedeeld met ..."
    .replace(/·\s*Shared with\b[^·\n]*/gi, "")
    .replace(/Meer\s+weergeven\b/gi, "")
    .replace(/See\s+more\b/gi, "")
    .replace(/Alle\s+reacties:\s*\d+/gi, "")
    .replace(/All\s+comments:\s*\d+/gi, "")
    .replace(/\bVind\s+ik\s+leuk\b/gi, "")
    .replace(/\bReageren\b/gi, "")
    .replace(/\bDelen\b/gi, "")
    .replace(/Opmerking\s+plaatsen\b/gi, "")
    .replace(/Meer\s+opmerkingen\s+weergeven\b/gi, "")
    .replace(/View\s+more\s+comments\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFacebookFeed(feed: FeedRecord): Promise<void> {
  console.log(`[facebook] scraping ${feed.url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
  });

  try {
    const page = await context.newPage();

    // Dismiss cookie consent dialogs if present
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

    await page.goto(feed.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Dismiss cookie banners
    const cookieBtn = page.getByRole("button", { name: /accept|allow|ok/i });
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    const posts = await page.evaluate(() => {
      const results: Array<{
        text: string;
        href: string;
        imgSrc: string;
        time: string;
      }> = [];

      // Post links typically contain /posts/ or /photos/
      const links = document.querySelectorAll(
        "a[href*='/posts/'], a[href*='/photos/'], a[href*='/videos/']"
      );

      const seen = new Set<string>();
      links.forEach((link) => {
        const href = (link as HTMLAnchorElement).href;
        if (!href || seen.has(href)) return;
        seen.add(href);

        const container = link.closest("[data-pagelet]") ?? link.parentElement;

        // Prefer [dir="auto"] elements which typically hold just the post body text
        const textNodes = container?.querySelectorAll('[dir="auto"]');
        let text = "";
        if (textNodes && textNodes.length > 0) {
          text = Array.from(textNodes)
            .map((el) => el.textContent?.trim() ?? "")
            .filter((t) => t.length > 10)
            .join(" ")
            .trim()
            .slice(0, 600);
        }
        if (!text) {
          text = container?.textContent?.trim().slice(0, 600) ?? "";
        }

        const img = container?.querySelector("img");
        const time = container?.querySelector("abbr[data-utime]");

        results.push({
          href,
          text,
          imgSrc: img?.src ?? "",
          time: time?.getAttribute("data-utime")
            ? new Date(Number(time.getAttribute("data-utime")) * 1000).toISOString()
            : "",
        });
      });

      return results.slice(0, 20);
    });

    for (const post of posts) {
      const guid = `${feed.id}::${post.href}`;
      const cleanText = cleanFacebookText(post.text);
      const data = {
        feed: feed.id,
        title: cleanText.slice(0, 200) || "Facebook post",
        summary: cleanText.slice(0, 500),
        content: "",
        url: post.href,
        image_url: post.imgSrc,
        author: "",
        published_at: post.time || new Date().toISOString(),
        guid,
      };

      try {
        await pb.collection("articles").getFirstListItem(`guid="${guid}"`);
      } catch {
        try {
          await pb.collection("articles").create(data);
        } catch (err) {
          console.error(`[facebook] failed to save post ${guid}:`, err);
        }
      }
    }

    await pb.collection("feeds").update(feed.id, {
      last_fetched: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[facebook] scrape failed for ${feed.url}:`, err);
  } finally {
    await browser.close();
  }
}
