import { scrapeListPage, type ScrapeConfig } from "~/lib/universalScraper";

const PREVIEW_TIMEOUT_MS = 20_000;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url;
  if (!url || typeof url !== "string") {
    throw createError({ statusCode: 400, message: "url is required" });
  }

  let config: ScrapeConfig = {};
  if (query.config && typeof query.config === "string") {
    try {
      config = JSON.parse(query.config);
    } catch {
      throw createError({ statusCode: 400, message: "config must be valid JSON" });
    }
  }

  const timeoutSignal = AbortSignal.timeout(PREVIEW_TIMEOUT_MS);

  try {
    const items = await Promise.race([
      scrapeListPage(url, config, 5),
      new Promise<never>((_, reject) =>
        timeoutSignal.addEventListener("abort", () => reject(new Error("Preview timed out")))
      ),
    ]);

    const detectedVia = items.length > 0 ? items[0].detected_via : null;

    return {
      items,
      detected_via: detectedVia,
      item_count: items.length,
    };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err?.message ?? "Failed to scrape URL",
    });
  }
});
