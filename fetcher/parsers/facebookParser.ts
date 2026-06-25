// Parser for public Facebook page HTML (plain HTTP, no JavaScript execution).
//
// All CSS selectors are centralized in the SELECTORS block below so that when
// Facebook changes its markup the fix is isolated to one place.
//
// Three parsing strategies are tried in order:
//   1. Mobile-site story/article containers  (m.facebook.com mid-2025 markup)
//   2. JSON-LD structured data embedded in <script type="application/ld+json">
//   3. Open Graph <meta property="og:*"> tags (yields at most one "post")
//
// Strategy 1 is the most likely to produce real post content; strategies 2 and 3
// are fallbacks that at least surface the page description.

import { parse as parseHtml, type HTMLElement } from "node-html-parser";

export interface FbPost {
  text: string;
  /** Absolute permalink to this post, if found */
  permalink?: string;
  /** ISO-8601 timestamp, if found */
  timestamp?: string;
  imageUrl?: string;
  authorName?: string;
}

// ─── Selectors ───────────────────────────────────────────────────────────────
// Update these when Facebook changes its markup rather than scattering fixes
// throughout the file.  Each comment names the element it targets.

const SELECTORS = {
  // Story/post wrapper elements on the mobile feed
  story: [
    "article",
    "div.story_body_container",  // classic m.facebook.com story block
    "[data-ft]",                 // JSON feed-type attribute present on many post wrappers
  ].join(", "),

  // Post text inside a story wrapper — prefer the innermost text-heavy element
  text: [
    'p',
    '[data-ft] > div:first-child',
    'div[class*="story"] > div',
    'h3',
    'h4',
  ].join(", "),

  // Permalink anchors — covers /story.php, /permalink/, /posts/ patterns
  permalink: [
    "a[href*='story.php']",
    "a[href*='/permalink/']",
    "a[href*='/posts/']",
  ].join(", "),

  // Timestamp elements
  time: [
    "abbr[data-store]",     // m.facebook.com stores unix time as JSON in data-store
    "abbr[title]",          // sometimes the title attribute is a human-readable date
    "time[datetime]",       // standard HTML5 time element
  ].join(", "),

  // Post images — exclude tiny emoji/icon images by filtering known small sizes
  image: "img[src]:not([src*='emoji']):not([width='16']):not([width='24']):not([src*='s32x32'])",
} as const;

// ─── Login wall detection ─────────────────────────────────────────────────────

// More thorough check using a parsed DOM (supplements the raw-string pre-check
// in facebookFetcher.ts which runs before we pay the parse cost).
export function isLoginWall(html: string): boolean {
  const root = parseHtml(html, { blockTextElements: { style: false, script: false } });
  const loginForms = root.querySelectorAll(
    "form[action*='/login/'], input[name='email'][type='email'], input[name='m_login_email']"
  );
  if (loginForms.length > 0) return true;

  // Heading-based heuristic for pages that replace a form with a "Log in" button
  const h2 = root.querySelector("h2");
  const h2text = h2?.text?.toLowerCase() ?? "";
  return h2text.includes("log in") || h2text.includes("sign in");
}

// ─── JSON-LD helpers ──────────────────────────────────────────────────────────

interface JsonLdNode {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string | { url?: string };
  url?: string;
  datePublished?: string;
  author?: { name?: string } | string;
  articleBody?: string;
}

function extractJsonLd(root: HTMLElement): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const script of root.querySelectorAll("script[type='application/ld+json']")) {
    try {
      const data: unknown = JSON.parse(script.text);
      if (Array.isArray(data)) nodes.push(...(data as JsonLdNode[]));
      else nodes.push(data as JsonLdNode);
    } catch {
      // Malformed JSON-LD — skip rather than crash
    }
  }
  return nodes;
}

// ─── Open Graph helpers ───────────────────────────────────────────────────────

interface OgData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

function extractOpenGraph(root: HTMLElement): OgData {
  const og: OgData = {};
  for (const meta of root.querySelectorAll("meta[property]")) {
    const prop = meta.getAttribute("property") ?? "";
    const content = meta.getAttribute("content") ?? "";
    if (prop === "og:title") og.title = content;
    else if (prop === "og:description") og.description = content;
    else if (prop === "og:image") og.image = content;
    else if (prop === "og:url") og.url = content;
  }
  return og;
}

// ─── Main parse entry point ───────────────────────────────────────────────────

export function parseFacebookPosts(html: string, pageUrl: string): FbPost[] {
  const root = parseHtml(html, { blockTextElements: { style: false, script: false } });

  // Strategy 1 — mobile story containers
  const stories = root.querySelectorAll(SELECTORS.story);
  if (stories.length > 0) {
    const posts = stories
      .slice(0, 25)
      .map((s) => extractFromStory(s, pageUrl))
      .filter((p): p is FbPost => p !== null);
    if (posts.length > 0) return dedupe(posts);
  }

  // Strategy 2 — JSON-LD
  const jsonLds = extractJsonLd(root);
  const ldPosts: FbPost[] = jsonLds
    .filter((n) =>
      n["@type"] === "SocialMediaPosting" ||
      n["@type"] === "Article" ||
      n["@type"] === "NewsArticle"
    )
    .map((n): FbPost => ({
      text: n.articleBody ?? n.description ?? n.name ?? "",
      permalink: n.url,
      timestamp: n.datePublished,
      imageUrl: typeof n.image === "string" ? n.image : n.image?.url,
      authorName: typeof n.author === "string" ? n.author : n.author?.name,
    }))
    .filter((p) => p.text.length > 0);

  if (ldPosts.length > 0) return dedupe(ldPosts);

  // Strategy 3 — Open Graph (page-level metadata only, not individual posts)
  const og = extractOpenGraph(root);
  if (og.title || og.description) {
    return [{
      text: og.description ?? og.title ?? "",
      permalink: og.url ?? pageUrl,
      imageUrl: og.image,
    }];
  }

  return [];
}

// ─── Story extraction ─────────────────────────────────────────────────────────

function extractFromStory(story: HTMLElement, pageUrl: string): FbPost | null {
  // Prefer [dir="auto"] text nodes which Facebook uses for post body text;
  // fall back to the first matching text selector, then the whole element text.
  const dirAuto = story.querySelectorAll('[dir="auto"]');
  let text = "";
  if (dirAuto.length > 0) {
    text = dirAuto
      .map((el) => el.text?.trim() ?? "")
      .filter((t) => t.length > 10)
      .join(" ")
      .trim();
  }
  if (!text) {
    const textEl = story.querySelector(SELECTORS.text);
    text = textEl?.text?.trim() ?? "";
  }
  if (!text) {
    text = story.text?.trim() ?? "";
  }
  if (!text || text.length < 5) return null;

  // Permalink
  const permalinkEl = story.querySelector(SELECTORS.permalink);
  let permalink = (permalinkEl?.getAttribute("href") ?? "").trim();
  if (permalink && !permalink.startsWith("http")) {
    permalink = `https://m.facebook.com${permalink}`;
  }

  // Timestamp
  let timestamp: string | undefined;
  const timeEl = story.querySelector(SELECTORS.time);
  if (timeEl) {
    const dataStore = timeEl.getAttribute("data-store");
    if (dataStore) {
      try {
        const parsed = JSON.parse(dataStore) as { time?: number };
        if (parsed.time) timestamp = new Date(parsed.time * 1000).toISOString();
      } catch { /* ignore malformed data-store */ }
    }
    if (!timestamp) {
      const raw = timeEl.getAttribute("datetime") ?? timeEl.getAttribute("title") ?? "";
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) timestamp = d.toISOString();
      }
    }
  }

  // Image
  const imgEl = story.querySelector(SELECTORS.image);
  const imageUrl = imgEl?.getAttribute("src") ?? undefined;

  return {
    text: text.slice(0, 600),
    permalink: permalink || undefined,
    timestamp,
    imageUrl,
  };
}

// ─── Stable GUID generation ───────────────────────────────────────────────────

export function buildPostGuid(feedId: string, post: Pick<FbPost, "permalink" | "text">): string {
  if (post.permalink) {
    return `${feedId}::${normalizePermalink(post.permalink)}`;
  }
  // No permalink — hash the first 200 chars of post text for a stable fallback.
  // Collisions are acceptable here; the real deduplication is guid + url uniqueness in PB.
  return `${feedId}::text:${djb2(post.text.slice(0, 200))}`;
}

// Strip tracking params from a permalink so the same post from mobile vs desktop
// Facebook domains produces the same GUID.
function normalizePermalink(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = "www.facebook.com"; // canonicalize mobile → desktop domain
    // Keep only the params that identify the post; discard fbclid, __cft__, etc.
    const keep = new URLSearchParams();
    for (const key of ["story_fbid", "id", "set", "permalink_id"]) {
      const val = u.searchParams.get(key);
      if (val) keep.set(key, val);
    }
    u.search = keep.toString();
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

// djb2 — simple 32-bit hash, good enough for deduplication hints
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// ─── In-memory deduplication ──────────────────────────────────────────────────

function dedupe(posts: FbPost[]): FbPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const key = p.permalink ?? p.text.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
