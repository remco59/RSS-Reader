// URL validation and normalization for Facebook public Pages and Groups.
// Personal profiles (profile.php, /people/) are explicitly rejected — they
// require login and are not public in the same sense as Pages/Groups.

export type FbUrlType = "page" | "group";

// Slugs that are Facebook's own internal navigation paths, not user Pages.
const FB_RESERVED = new Set([
  "login", "logout", "signup", "register", "home", "settings", "help",
  "privacy", "legal", "policies", "about", "careers", "ads", "business",
  "marketplace", "gaming", "watch", "news", "events", "messages",
  "notifications", "story.php", "sharer", "share", "photo", "video",
  "stories", "people", "find-friends", "profile.php",
]);

export interface FbUrlValidation {
  valid: boolean;
  error?: string;
  type?: FbUrlType;
  /** Canonical https://www.facebook.com/... URL, query params stripped */
  normalized?: string;
}

export function validateFacebookUrl(raw: string): FbUrlValidation {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { valid: false, error: "Not a valid URL." };
  }

  if (!["facebook.com", "www.facebook.com"].includes(url.hostname.toLowerCase())) {
    return { valid: false, error: "URL must be a facebook.com address." };
  }

  const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length === 0) {
    return { valid: false, error: "URL must point to a specific Page or Group, not the Facebook homepage." };
  }

  const first = segments[0].toLowerCase();

  if (FB_RESERVED.has(first)) {
    return {
      valid: false,
      error: "This URL looks like an internal Facebook path, not a public Page or Group.",
    };
  }

  // facebook.com/groups/<identifier>
  if (first === "groups" && segments.length >= 2) {
    const normalized = buildNormalized(url, segments.join("/"));
    return { valid: true, type: "group", normalized };
  }

  // facebook.com/pages/<readable-name>/<numeric-id>
  if (first === "pages" && segments.length >= 3) {
    const normalized = buildNormalized(url, segments.slice(0, 3).join("/"));
    return { valid: true, type: "page", normalized };
  }

  // facebook.com/<VanityName>  (must not look like profile.php)
  if (segments.length === 1 && first !== "profile.php") {
    // Vanity URLs are 3–50 chars: letters, digits, dots, hyphens
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,49}$/.test(segments[0])) {
      return {
        valid: false,
        error: "Facebook page vanity names must be 3–50 characters (letters, digits, dots, hyphens).",
      };
    }
    const normalized = buildNormalized(url, segments[0]);
    return { valid: true, type: "page", normalized };
  }

  return {
    valid: false,
    error:
      "Could not recognise this as a Facebook Page or Group URL. " +
      "Expected format: facebook.com/PageName or facebook.com/groups/GroupName",
  };
}

function buildNormalized(original: URL, pathSuffix: string): string {
  // Always use https://www.facebook.com, strip all query params and hash
  return `https://www.facebook.com/${pathSuffix}`;
}

// Convert a www.facebook.com URL to its m.facebook.com equivalent.
// The mobile site renders simpler server-side HTML that is more amenable to
// plain-HTTP scraping than the fully JavaScript-rendered desktop site.
export function toMobileUrl(normalizedUrl: string): string {
  try {
    const u = new URL(normalizedUrl);
    u.hostname = "m.facebook.com";
    return u.toString();
  } catch {
    return normalizedUrl;
  }
}
