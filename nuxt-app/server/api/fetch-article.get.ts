import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; FeedFlow/1.0; +https://github.com/feedflow)";

const SOCIAL_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "instagram.com", "www.instagram.com"];

export default defineEventHandler(async (event) => {
  const { url } = getQuery(event);
  if (!url || typeof url !== "string") {
    throw createError({ statusCode: 400, message: "url is required" });
  }

  // Social platforms require login — skip fetching to avoid wasting the timeout
  try {
    const host = new URL(url).hostname;
    if (SOCIAL_HOSTS.includes(host)) {
      return { content: null, title: null, source: "none" };
    }
  } catch {
    // invalid URL — let it fall through and fail naturally
  }

  // 1. Try fetching directly from the article URL
  const direct = await fetchAndExtract(url);
  if (direct) return { content: direct.content, title: direct.title, source: "direct" };

  // 2. Try via archive.ph
  const archiveUrl = `https://archive.ph/newest/${encodeURIComponent(url)}`;
  const archived = await fetchAndExtract(archiveUrl, url);
  if (archived) return { content: archived.content, title: archived.title, source: "archive" };

  // 3. Signal client to fall back to RSS summary
  return { content: null, title: null, source: "none" };
});

async function fetchAndExtract(
  fetchUrl: string,
  documentUrl?: string,
): Promise<{ content: string; title: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,nl;q=0.8",
      },
      redirect: "follow",
    }).finally(() => clearTimeout(timer));

    if (!response.ok) return null;

    const html = await response.text();
    if (!html) return null;

    const dom = new JSDOM(html, { url: documentUrl ?? fetchUrl });
    const reader = new Readability(dom.window.document, { charThreshold: 100 });
    const parsed = reader.parse();

    if (!parsed?.content || parsed.content.trim().length < 200) return null;

    return { content: parsed.content, title: parsed.title ?? "" };
  } catch {
    return null;
  }
}
