import { chromium } from "playwright";
import { pb } from "../pb.js";

interface FeedRecord {
  id: string;
  name: string;
  url: string;
}

export async function fetchInstagramFeed(feed: FeedRecord): Promise<void> {
  console.log(`[instagram] scraping ${feed.url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    await page.goto(feed.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const posts = await page.evaluate(() => {
      const results: Array<{ href: string }> = [];

      const links = document.querySelectorAll("a[href*='/p/']");
      links.forEach((link) => {
        const href = (link as HTMLAnchorElement).href;
        if (href && link.querySelector("img")) {
          results.push({ href });
        }
      });

      return results.slice(0, 10);
    });

    for (const post of posts) {
      const guid = `${feed.id}::${post.href}`;

      // Check if already saved before fetching the post page
      try {
        await pb.collection("articles").getFirstListItem(`guid="${guid}"`);
        continue;
      } catch {
        // Not found, proceed to fetch caption
      }

      // Visit the individual post page to get caption, image, and date from meta tags
      let caption = "";
      let imageUrl = "";
      let publishedAt = new Date().toISOString();
      try {
        const postPage = await context.newPage();
        await postPage.goto(post.href, { waitUntil: "networkidle", timeout: 30000 });
        const meta = await postPage.evaluate(() => {
          const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "";
          let caption = ogDesc;
          // Instagram og:description format: 'N likes, M comments - Name: "Caption" on Date...'
          const match = ogDesc.match(/:\s*"([\s\S]+?)"\s*(?:on\s|\.|$)/);
          if (match) {
            caption = match[1].trim();
          } else {
            const colonIdx = ogDesc.indexOf(": ");
            if (colonIdx !== -1) caption = ogDesc.slice(colonIdx + 2).replace(/^"(.+)"$/, "$1").trim();
          }
          const imageUrl = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
          const publishedAt =
            document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
            document.querySelector('meta[property="og:article:published_time"]')?.getAttribute("content") ||
            document.querySelector("time[datetime]")?.getAttribute("datetime") ||
            "";
          return { caption, imageUrl, publishedAt };
        });
        caption = meta.caption;
        if (meta.imageUrl) imageUrl = meta.imageUrl;
        if (meta.publishedAt) publishedAt = new Date(meta.publishedAt).toISOString();
        await postPage.close();
      } catch (err) {
        console.error(`[instagram] failed to fetch post page for ${post.href}:`, err);
      }

      const title = caption ? caption.split("\n")[0].slice(0, 200) : "Instagram post";
      const data = {
        feed: feed.id,
        title,
        summary: caption.slice(0, 500) || title,
        content: caption,
        url: post.href,
        image_url: imageUrl,
        author: feed.name,
        published_at: publishedAt,
        guid,
      };

      try {
        await pb.collection("articles").create(data);
      } catch (err) {
        console.error(`[instagram] failed to save post ${guid}:`, err);
      }
    }

    await pb.collection("feeds").update(feed.id, {
      last_fetched: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[instagram] scrape failed for ${feed.url}:`, err);
  } finally {
    await browser.close();
  }
}
