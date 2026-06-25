import PocketBase from "pocketbase";

interface ImportFeed {
  name: string;
  url: string;
  type?: string;
  category?: string | null;
  alias?: string | null;
  fetch_interval_mins?: number;
  description?: string | null;
  favicon?: string | null;
  scrape_config?: string | null;
}

interface ImportCategory {
  name: string;
  color?: string | null;
  icon?: string | null;
}

interface ImportPayload {
  feeds: ImportFeed[];
  categories?: ImportCategory[];
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const pb = new PocketBase(config.pocketbaseUrl);

  const cookie = getRequestHeader(event, "cookie") ?? "";
  pb.authStore.loadFromCookie(cookie);

  if (!pb.authStore.isValid) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const userId = (pb.authStore.model as any).id as string;
  const payload = await readBody<ImportPayload>(event);

  if (!payload?.feeds || !Array.isArray(payload.feeds)) {
    throw createError({ statusCode: 400, message: "Invalid payload: feeds array required" });
  }

  // Load existing categories into a name→id map
  const existingCats = await pb.collection("categories").getFullList({
    filter: `user = "" || user = "${userId}"`,
  });
  const catIdMap = new Map<string, string>(
    (existingCats as any[]).map((c) => [c.name as string, c.id as string]),
  );

  // Create any new categories from the import payload
  for (const cat of payload.categories ?? []) {
    if (!cat.name || catIdMap.has(cat.name)) continue;
    const created = await pb.collection("categories").create({
      name: cat.name,
      color: cat.color ?? "",
      icon: cat.icon ?? "",
      user: userId,
    });
    catIdMap.set(cat.name, (created as any).id);
  }

  // Create categories referenced by feeds that weren't in the categories list
  for (const f of payload.feeds) {
    if (!f.category || catIdMap.has(f.category)) continue;
    const created = await pb.collection("categories").create({
      name: f.category,
      color: "",
      icon: "",
      user: userId,
    });
    catIdMap.set(f.category, (created as any).id);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const f of payload.feeds) {
    if (!f.url) continue;
    try {
      const categoryId = f.category ? (catIdMap.get(f.category) ?? "") : "";
      const escapedUrl = f.url.replace(/'/g, "\\'");

      // Find or create the feed record
      let feed: any;
      try {
        feed = await pb.collection("feeds").getFirstListItem(`url = '${escapedUrl}'`);
        // Backfill category if feed has none and we know one
        if (categoryId && !feed.category) {
          await pb.collection("feeds").update(feed.id, { category: categoryId });
        }
      } catch {
        feed = await pb.collection("feeds").create({
          name: f.name || f.url,
          url: f.url,
          type: f.type || "rss",
          category: categoryId,
          description: f.description ?? "",
          favicon: f.favicon ?? "",
          fetch_interval_mins: f.fetch_interval_mins ?? 60,
          is_active: true,
          scrape_config: f.scrape_config ?? "",
        });
      }

      // Subscribe the user to this feed
      try {
        await pb.collection("user_feeds").create({
          user: userId,
          feed: feed.id,
          alias: f.alias ?? "",
        });
        imported++;
      } catch (e: any) {
        // 400 = already subscribed (unique constraint)
        if (e?.status === 400) {
          skipped++;
        } else {
          throw e;
        }
      }
    } catch (e: any) {
      errors.push(`${f.name ?? f.url}: ${e.message ?? "Unknown error"}`);
    }
  }

  return { imported, skipped, errors };
});
