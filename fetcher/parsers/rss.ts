import Parser from "rss-parser";
import { pb } from "../pb.js";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["enclosure", "enclosure", { keepArray: false }],
    ],
  },
});

interface FeedRecord {
  id: string;
  name: string;
  url: string;
  type: string;
}

function extractImage(item: Record<string, unknown>): string | undefined {
  const mc = item.mediaContent as { $?: { url?: string } } | undefined;
  if (mc?.$?.url) return mc.$.url;
  const mt = item.mediaThumbnail as { $?: { url?: string } } | undefined;
  if (mt?.$?.url) return mt.$.url;
  const enc = item.enclosure as { url?: string; type?: string } | undefined;
  if (enc?.url && enc.type?.startsWith("image/")) return enc.url;
  const content = (item.content ?? item["content:encoded"] ?? "") as string;
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function buildGuid(feedId: string, item: Record<string, unknown>): string {
  const raw = (item.guid ?? item.link ?? item.title) as string | undefined;
  return `${feedId}::${raw ?? String(Date.now())}`;
}

async function fetchOgImage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FeedFetcher/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

async function fetchAndCleanXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FeedFetcher/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // Fix bare HTML boolean attributes (e.g. `loading`, `async`, `disabled`) that lack a value.
  // The strict SAX parser in xml2js rejects these as invalid XML.
  // Only match opening/self-closing element tags (<img ...>) — skips CDATA, declarations, closing tags.
  return text.replace(/<[a-zA-Z][^>]*>/g, (tag) =>
    tag.replace(/ ([a-zA-Z][a-zA-Z0-9:_-]*)(?!=)(?=[ \t\n\r\/>])/g, ' $1=""')
  );
}

export async function fetchRssFeed(feed: FeedRecord): Promise<void> {
  console.log(`[rss] fetching ${feed.url}`);
  let parsed;
  try {
    const xml = await fetchAndCleanXml(feed.url);
    parsed = await parser.parseString(xml);
  } catch (err) {
    console.error(`[rss] failed to parse ${feed.url}:`, err);
    return;
  }

  console.log(`[rss] parsed ${parsed.items.length} items from ${feed.url}`);

  let created = 0;
  let skipped = 0;
  let existing = 0;

  for (const item of parsed.items) {
    const guid = buildGuid(feed.id, item as Record<string, unknown>);
    const image = extractImage(item as Record<string, unknown>);

    const data = {
      feed: feed.id,
      title: item.title?.trim() ?? "Untitled",
      summary: item.contentSnippet?.slice(0, 2000) ?? "",
      content: item["content:encoded"] ?? item.content ?? "",
      url: item.link ?? "",
      image_url: image ?? "",
      author: item.creator ?? item.author ?? "",
      published_at: (() => { try { const d = item.pubDate ? new Date(item.pubDate) : null; return d && isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString(); } catch { return new Date().toISOString(); } })(),
      guid,
    };

    if (!data.url) {
      console.warn(`[rss] skipping item with no URL: "${data.title}"`);
      skipped++;
      continue;
    }

    try {
      await pb.collection("articles").getFirstListItem(`guid="${guid}"`);
      existing++;
    } catch {
      // Also check by URL to deduplicate articles that appear in multiple feeds
      if (data.url) {
        try {
          const encodedUrl = data.url.replace(/"/g, '\\"');
          await pb.collection("articles").getFirstListItem(`url="${encodedUrl}"`);
          existing++;
          continue;
        } catch {
          // Not found by URL either — safe to create
        }
      }
      if (!data.image_url && data.url) {
        data.image_url = await fetchOgImage(data.url);
      }
      try {
        await pb.collection("articles").create(data);
        created++;
      } catch (err) {
        console.error(`[rss] failed to save article "${data.title}":`, err);
      }
    }
  }

  console.log(`[rss] ${feed.url} — created: ${created}, existing: ${existing}, skipped: ${skipped}`);

  await pb.collection("feeds").update(feed.id, {
    last_fetched: new Date().toISOString(),
  });
}
