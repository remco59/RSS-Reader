// Plain-HTTP fetcher for public Facebook page HTML.
// Uses the mobile site (m.facebook.com) which returns simpler server-rendered HTML.
// No cookies, no login — Facebook may return a login wall or block access entirely;
// callers must inspect FetchResult.blocked and handle gracefully.
//
// Limitations:
// - Facebook increasingly requires login for public page content, so this may fail
//   for many pages even if they are technically "public".
// - No JavaScript execution; dynamically loaded posts will not appear.
// - Facebook rate-limits aggressive scrapers; keep fetch_interval_mins >= 120.

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

// Mobile Chrome UA. A mobile UA avoids the "download our app" redirect that
// the desktop UA sometimes triggers on m.facebook.com.
const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

export interface FetchResult {
  html?: string;
  /** True when Facebook returned a login gate or access-denied response */
  blocked: boolean;
  error?: string;
  statusCode?: number;
}

export async function fetchFacebookPageHtml(mobileUrl: string): Promise<FetchResult> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(2_500);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(mobileUrl, {
        headers: REQUEST_HEADERS,
        redirect: "follow",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if ((err as Error)?.name === "AbortError") {
        return {
          blocked: false,
          error: `Request timed out after ${TIMEOUT_MS / 1000}s.`,
        };
      }
      // Retry transient network errors
      continue;
    }
    clearTimeout(timer);

    if (response.status === 429) {
      return {
        blocked: true,
        statusCode: 429,
        error: "Facebook rate-limited this request (HTTP 429). Try again later.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        blocked: true,
        statusCode: response.status,
        error: `Facebook denied access (HTTP ${response.status}).`,
      };
    }
    if (!response.ok) {
      return {
        blocked: false,
        statusCode: response.status,
        error: `Unexpected HTTP status ${response.status}.`,
      };
    }

    const html = await response.text();

    if (containsLoginWallSignals(html)) {
      return {
        blocked: true,
        statusCode: response.status,
        error:
          "Facebook requires login to view this page. " +
          "Only fully public Pages/Groups are supported.",
      };
    }

    return { html, blocked: false, statusCode: response.status };
  }

  return {
    blocked: false,
    error: `Network error: ${(lastErr as Error)?.message ?? String(lastErr)}`,
  };
}

// Quick string-level login wall check before full HTML parsing.
// These strings appear in Facebook's login interstitial pages.
function containsLoginWallSignals(html: string): boolean {
  return (
    html.includes('id="loginbutton"') ||
    html.includes('name="login"') ||
    html.includes("/login/?next=") ||
    html.includes('action="https://www.facebook.com/login/') ||
    html.includes('action="https://m.facebook.com/login/') ||
    html.includes("You must log in to continue") ||
    // Covers the "Log in to Facebook to see..." interstitial
    (html.includes("Log in to Facebook") && html.includes("m_login_email"))
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
