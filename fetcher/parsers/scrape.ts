import { pb } from "../pb.js";
import { scrapeListPage, type ScrapeConfig } from "../lib/universalScraper.js";

interface FeedRecord {
  id: string;
  name: string;
  url: string;
  type: string;
  scrape_config?: string | null;
}

export async function fetchScrapeFeed(feed: FeedRecord): Promise<void> {
  console.log(`[scrape] fetching ${feed.url}`);

  let config: ScrapeConfig = {};
  if (feed.scrape_config) {
    try { config = JSON.parse(feed.scrape_config); } catch { /* ignore malformed config */ }
  }

  let items;
  try {
    items = await scrapeListPage(feed.url, config, 20);
  } catch (err) {
    console.error(`[scrape] failed to load ${feed.url}:`, err);
    await pb.collection("feeds").update(feed.id, {
      last_error: String(err),
      last_error_at: new Date().toISOString(),
    });
    return;
  }

  console.log(`[scrape] found ${items.length} items`);
  let created = 0;
  let existing = 0;

  for (const item of items) {
    const guid = `${feed.id}::${item.url}`;

    try {
      await pb.collection("articles").getFirstListItem(`guid="${guid}"`);
      existing++;
      continue;
    } catch { /* not found */ }

    try {
      await pb.collection("articles").getFirstListItem(
        `url="${item.url.replace(/"/g, '\\"')}"`
      );
      existing++;
      continue;
    } catch { /* not found — proceed */ }

    try {
      await pb.collection("articles").create({
        feed: feed.id,
        title: item.title,
        summary: item.summary ?? "",
        content: "",
        url: item.url,
        image_url: item.image_url ?? "",
        author: "",
        published_at: item.published_at ?? new Date().toISOString(),
        guid,
      });
      created++;
    } catch (err) {
      console.error(`[scrape] failed to save "${item.title}":`, err);
    }
  }

  console.log(`[scrape] ${feed.url} — created: ${created}, existing: ${existing}`);

  await pb.collection("feeds").update(feed.id, {
    last_fetched: new Date().toISOString(),
    last_error: "",
    last_error_at: "",
  });
}
