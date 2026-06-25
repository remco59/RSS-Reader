import cron from "node-cron";
import http from "http";
import { authenticate, pb } from "./pb.js";
import { fetchRssFeed } from "./parsers/rss.js";
import { fetchInstagramFeed } from "./parsers/instagram.js";
import { fetchFacebookFeed } from "./parsers/facebook.js";
import { fetchFacebookPublicPageFeed } from "./parsers/facebookPublicPage.js";
import { fetchScrapeFeed } from "./parsers/scrape.js";

interface Feed {
  id: string;
  name: string;
  url: string;
  type: "rss" | "instagram" | "facebook" | "youtube" | "facebook_public_page" | "scrape";
  fetch_interval_mins: number;
  last_fetched: string;
  is_active: boolean;
}

function isDue(feed: Feed, force: boolean): boolean {
  if (force || !feed.last_fetched) return true;
  const intervalMs = (feed.fetch_interval_mins ?? 60) * 60 * 1000;
  return Date.now() - new Date(feed.last_fetched).getTime() >= intervalMs;
}

let fetcherRunning = false;

async function runFetcher(force = false) {
  if (fetcherRunning) {
    console.log("[fetcher] already running, skipping");
    return;
  }
  fetcherRunning = true;
  try {
    let feeds: Feed[];
    try {
      const result = await pb.collection("feeds").getFullList<Feed>({
        filter: "is_active = true",
      });
      feeds = result;
    } catch (err) {
      console.error("[fetcher] failed to load feeds:", err);
      return;
    }

    const due = feeds.filter((f) => isDue(f, force));
    console.log(
      `[fetcher] ${due.length}/${feeds.length} feeds due for refresh${force ? " (forced)" : ""}`
    );

    for (const feed of due) {
      try {
        if (feed.type === "rss" || feed.type === "youtube") {
          await fetchRssFeed(feed);
        } else if (feed.type === "instagram") {
          await fetchInstagramFeed(feed);
        } else if (feed.type === "facebook") {
          await fetchFacebookFeed(feed);
        } else if (feed.type === "facebook_public_page") {
          await fetchFacebookPublicPageFeed(feed);
        } else if (feed.type === "scrape") {
          await fetchScrapeFeed(feed);
        }
      } catch (err) {
        console.error(`[fetcher] unhandled error for feed ${feed.id}:`, err);
      }
    }
  } finally {
    fetcherRunning = false;
  }
}

function startApiServer() {
  const port = process.env.FETCHER_API_PORT ? Number(process.env.FETCHER_API_PORT) : 3001;
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"status":"ok"}');
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith("/fetch")) {
      res.writeHead(404).end("Not found");
      return;
    }
    const force = new URL(req.url, "http://localhost").searchParams.get("force") === "true";
    console.log(`[fetcher] manual trigger received (force=${force})`);
    runFetcher(force).catch((err) => console.error("[fetcher] manual trigger error:", err));
    res.writeHead(202).end(JSON.stringify({ triggered: true, force }));
  });
  server.listen(port, () => console.log(`[fetcher] API listening on port ${port}`));
}

async function main() {
  // Retry auth a few times to handle PocketBase startup delay
  for (let i = 0; i < 10; i++) {
    try {
      await authenticate();
      break;
    } catch {
      console.log(`[fetcher] waiting for PocketBase... (attempt ${i + 1}/10)`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  startApiServer();

  // Run immediately on startup, then every 5 minutes
  await runFetcher();
  cron.schedule("*/5 * * * *", () => runFetcher());
  console.log("[fetcher] scheduler running — checking every 5 minutes");
}

main().catch((err) => {
  console.error("[fetcher] fatal:", err);
  process.exit(1);
});
