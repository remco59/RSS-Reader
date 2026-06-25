import { JSDOM } from "jsdom";

export interface ScrapeConfig {
  item_selector?: string;
  link_selector?: string;
  title_selector?: string;
  image_selector?: string;
  date_selector?: string;
  url_pattern?: string;
}

export interface ScrapedItem {
  title: string;
  url: string;
  image_url?: string;
  summary?: string;
  published_at?: string;
  detected_via: "json-ld" | "open-graph" | "html-fallback";
}

const USER_AGENT = "Mozilla/5.0 (compatible; FeedFetcher/1.0)";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function toAbsolute(href: string, origin: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return null;
  try {
    return new URL(href, origin).href;
  } catch {
    return null;
  }
}

// Extracts a URL from onclick="location.href='/path/to/page'" patterns
function onclickUrl(onclick: string): string | null {
  const m = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function findItemUrls(doc: Document, pageUrl: string, config: ScrapeConfig): string[] {
  const origin = new URL(pageUrl).origin;
  const seen = new Set<string>();
  const urls: string[] = [];

  function add(href: string) {
    const abs = toAbsolute(href, origin);
    if (abs && abs.startsWith(origin) && abs !== pageUrl && !seen.has(abs)) {
      seen.add(abs);
      urls.push(abs);
    }
  }

  // Config-based
  if (config.item_selector) {
    const linkSel = config.link_selector || "a";
    for (const item of doc.querySelectorAll(config.item_selector)) {
      // Try child link first
      const childHref = item.querySelector(linkSel)?.getAttribute("href");
      if (childHref) { add(childHref); continue; }
      // Fall back to onclick on the container itself
      const oc = item.getAttribute("onclick") ?? "";
      const ocUrl = onclickUrl(oc);
      if (ocUrl) add(ocUrl);
    }
    if (urls.length > 0) return applyPattern(urls, config);
  }

  // JSON-LD ItemList
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      const candidates =
        data["@type"] === "ItemList" ? (data.itemListElement ?? []) :
        Array.isArray(data["@graph"]) ? data["@graph"] : [];
      for (const item of candidates) {
        const u = item.url ?? item["@id"] ?? item.item?.url;
        if (u && typeof u === "string") add(u);
      }
    } catch { /* ignore */ }
  }
  if (urls.length >= 3) return applyPattern(urls, config);

  // onclick="location.href='...'" elements (e.g. uitzinnig.nl-style cards)
  for (const el of doc.querySelectorAll("[onclick]")) {
    const u = onclickUrl(el.getAttribute("onclick") ?? "");
    if (u) add(u);
  }
  if (urls.length >= 3) return applyPattern(urls, config);

  // Common semantic containers
  const containerSelectors = [
    "article", ".post", ".card", ".event", ".item", ".entry",
    "[class*='article']", "[class*='event']", "[class*='post']",
  ];
  for (const sel of containerSelectors) {
    for (const el of doc.querySelectorAll(sel)) {
      const href = el.querySelector("a")?.getAttribute("href");
      if (href) add(href);
    }
    if (urls.length >= 3) break;
  }
  if (urls.length >= 3) return applyPattern(urls, config);

  // URL-pattern grouping: group internal links by first path segment
  const groups = new Map<string, string[]>();
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    const abs = toAbsolute(href, origin);
    if (!abs || !abs.startsWith(origin) || seen.has(abs)) continue;
    const text = a.textContent?.trim();
    if (!text || text.length < 2) continue;
    try {
      const parts = new URL(abs).pathname.split("/").filter(Boolean);
      const prefix = parts.length >= 1 ? "/" + parts[0] : "/";
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push(abs);
      seen.add(abs);
    } catch { /* ignore */ }
  }

  let best: string[] = [];
  for (const [prefix, group] of groups) {
    if (prefix !== "/" && group.length >= 3 && group.length > best.length) best = group;
  }
  const fallback = best.length >= 3 ? best : [...seen];
  return applyPattern(fallback, config);
}

function applyPattern(urls: string[], config: ScrapeConfig): string[] {
  return config.url_pattern ? urls.filter((u) => u.includes(config.url_pattern!)) : urls;
}

function extractJsonLd(doc: Document): Record<string, any> | null {
  const targetTypes = new Set(["Event", "NewsArticle", "Article", "BlogPosting"]);
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      if (targetTypes.has(data["@type"])) return data;
      if (Array.isArray(data["@graph"])) {
        const found = data["@graph"].find((n: any) => targetTypes.has(n["@type"]));
        if (found) return found;
      }
    } catch { /* ignore */ }
  }
  return null;
}

function resolveImage(image: any): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image || undefined;
  if (Array.isArray(image)) return resolveImage(image[0]);
  return image.url ?? undefined;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return new Date(value).toISOString(); } catch { return undefined; }
}

function getImgSrc(el: Element | null): string | undefined {
  return el?.getAttribute("src") ?? el?.getAttribute("data-src") ?? undefined;
}

function extractMetadata(doc: Document, url: string, config: ScrapeConfig): Omit<ScrapedItem, "url"> {
  const origin = new URL(url).origin;

  // JSON-LD
  const ld = extractJsonLd(doc);
  if (ld) {
    return {
      title: (ld.name ?? ld.headline ?? "").trim() || "Untitled",
      summary: (ld.description ?? "").slice(0, 2000) || undefined,
      image_url: resolveImage(ld.image),
      published_at: parseDate(ld.startDate ?? ld.datePublished),
      detected_via: "json-ld",
    };
  }

  // Open Graph
  const og: Record<string, string> = {};
  for (const meta of doc.querySelectorAll("meta[property],meta[name]")) {
    const key = meta.getAttribute("property") ?? meta.getAttribute("name") ?? "";
    const val = meta.getAttribute("content") ?? "";
    if (key.startsWith("og:") || key.startsWith("article:") || key === "description") og[key] = val;
  }
  if (og["og:title"]) {
    return {
      title: og["og:title"].trim() || "Untitled",
      summary: (og["og:description"] ?? og["description"] ?? "").slice(0, 2000) || undefined,
      image_url: og["og:image"] || undefined,
      published_at: parseDate(og["article:published_time"]),
      detected_via: "open-graph",
    };
  }

  // HTML fallback
  const titleEl = config.title_selector
    ? doc.querySelector(config.title_selector)
    : doc.querySelector("h1");
  const title = titleEl?.textContent?.trim() || new URL(url).pathname.split("/").pop() || "Untitled";

  const descMeta = doc.querySelector("meta[name='description']");
  const summary =
    descMeta?.getAttribute("content")?.slice(0, 2000) ||
    doc.querySelector("p")?.textContent?.trim().slice(0, 2000) ||
    undefined;

  const imgEl = config.image_selector
    ? doc.querySelector(config.image_selector)
    : (doc.querySelector("img[src]") ?? doc.querySelector("img[data-src]"));
  const src = getImgSrc(imgEl);
  const image_url = src ? toAbsolute(src, origin) ?? undefined : undefined;

  const dateEl = config.date_selector
    ? doc.querySelector(config.date_selector)
    : doc.querySelector("time");
  const dateText = dateEl?.getAttribute("datetime") ?? dateEl?.textContent?.trim();
  const published_at = parseDate(dateText);

  return { title, summary, image_url, published_at, detected_via: "html-fallback" };
}

export async function scrapeListPage(
  pageUrl: string,
  config: ScrapeConfig = {},
  limit = 5,
): Promise<ScrapedItem[]> {
  const html = await fetchHtml(pageUrl);
  const listDoc = new JSDOM(html, { url: pageUrl }).window.document;
  const urls = findItemUrls(listDoc, pageUrl, config).slice(0, limit);

  const items: ScrapedItem[] = [];
  for (const url of urls) {
    try {
      const itemHtml = await fetchHtml(url);
      const doc = new JSDOM(itemHtml, { url }).window.document;
      const meta = extractMetadata(doc, url, config);
      items.push({ url, ...meta });
    } catch { /* skip failed items silently in preview */ }
  }
  return items;
}
