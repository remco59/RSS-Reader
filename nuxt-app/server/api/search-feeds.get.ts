export interface FeedSearchResult {
  url: string;
  title: string;
  description: string;
  favicon: string;
  site_url: string;
  site_name: string;
}

interface FeedlyResult {
  id: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  website?: string;
  language?: string;
  subscribers?: number;
}

export default defineEventHandler(async (event) => {
  const { q } = getQuery(event);
  const term = String(q ?? "").trim();
  if (!term) return [] as FeedSearchResult[];

  const data = await $fetch<{ results: FeedlyResult[] }>(
    `https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(term)}&count=20`,
  ).catch(() => ({ results: [] }));

  return (data.results ?? []).map((r): FeedSearchResult => {
    const url = r.id.startsWith("feed/") ? r.id.slice(5) : r.id;
    return {
      url,
      title: r.title ?? "",
      description: r.description ?? "",
      favicon: r.iconUrl ?? "",
      site_url: r.website ?? "",
      site_name: r.title ?? "",
    };
  });
});
