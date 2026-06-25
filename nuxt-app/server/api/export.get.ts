import PocketBase from "pocketbase";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const pb = new PocketBase(config.pocketbaseUrl);

  const cookie = getRequestHeader(event, "cookie") ?? "";
  pb.authStore.loadFromCookie(cookie);

  if (!pb.authStore.isValid) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const userId = (pb.authStore.model as any).id as string;
  const { format } = getQuery(event);

  const [userFeeds, categories] = await Promise.all([
    pb.collection("user_feeds").getFullList({
      filter: `user = "${userId}"`,
      expand: "feed,feed.category",
      sort: "alias,feed.name",
    }),
    pb.collection("categories").getFullList({
      filter: `user = "" || user = "${userId}"`,
      sort: "name",
    }),
  ]);

  if (format === "opml") {
    setResponseHeader(event, "Content-Type", "text/x-opml+xml; charset=utf-8");
    return buildOpml(userFeeds as any[], categories as any[]);
  }

  return buildJson(userFeeds as any[], categories as any[]);
});

function buildOpml(userFeeds: any[], _categories: any[]): string {
  const now = new Date().toUTCString();

  // Group feeds by category id
  const catById = new Map<string, { name: string }>();
  const byCatId = new Map<string, { uf: any; feed: any }[]>();

  for (const uf of userFeeds) {
    const feed = uf.expand?.feed;
    if (!feed) continue;
    const cat = feed.expand?.category;
    const catId = feed.category ?? "";
    if (cat && !catById.has(catId)) catById.set(catId, { name: cat.name });
    if (!byCatId.has(catId)) byCatId.set(catId, []);
    byCatId.get(catId)!.push({ uf, feed });
  }

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>FeedFlow Subscriptions</title>",
    `    <dateCreated>${now}</dateCreated>`,
    "  </head>",
    "  <body>",
  ];

  // Uncategorized feeds first
  for (const { uf, feed } of byCatId.get("") ?? []) {
    const name = esc(uf.alias || feed.name);
    const url = esc(feed.url);
    lines.push(`    <outline text="${name}" title="${name}" type="rss" xmlUrl="${url}" />`);
  }

  // Categorized feeds grouped by category
  for (const [catId, items] of byCatId) {
    if (!catId) continue;
    const catName = esc(catById.get(catId)?.name ?? catId);
    lines.push(`    <outline text="${catName}" title="${catName}">`);
    for (const { uf, feed } of items) {
      const name = esc(uf.alias || feed.name);
      const url = esc(feed.url);
      lines.push(`      <outline text="${name}" title="${name}" type="rss" xmlUrl="${url}" />`);
    }
    lines.push("    </outline>");
  }

  lines.push("  </body>", "</opml>");
  return lines.join("\n");
}

function buildJson(userFeeds: any[], categories: any[]): object {
  return {
    version: "1.0",
    app: "feedflow",
    exported_at: new Date().toISOString(),
    categories: categories.map((c) => ({
      name: c.name,
      color: c.color || null,
      icon: c.icon || null,
    })),
    feeds: userFeeds
      .filter((uf) => uf.expand?.feed)
      .map((uf) => {
        const feed = uf.expand.feed;
        const cat = feed.expand?.category;
        return {
          name: feed.name,
          url: feed.url,
          type: feed.type,
          category: cat?.name ?? null,
          alias: uf.alias || null,
          fetch_interval_mins: feed.fetch_interval_mins ?? 60,
          description: feed.description || null,
          favicon: feed.favicon || null,
          scrape_config: feed.scrape_config ?? null,
        };
      }),
  };
}

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
