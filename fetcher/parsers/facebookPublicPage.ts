// Orchestrator for the facebook_public_page feed type.
// Combines URL normalization, HTTP fetching, HTML parsing, and PocketBase
// persistence.  All other feed types (rss, youtube, instagram, facebook) are
// unaffected by this module.
//
// Important constraints:
// - Plain HTTP only (no Playwright / browser automation).
// - Only works for Pages/Groups with fully public content.
// - When Facebook blocks access or shows a login wall the error is written to
//   the feed record so the UI can surface it; no articles are created.

import { pb } from "../pb.js";
import { toMobileUrl } from "./facebookSource.js";
import { fetchFacebookPageHtml } from "./facebookFetcher.js";
import { parseFacebookPosts, buildPostGuid, isLoginWall } from "./facebookParser.js";

interface FeedRecord {
  id: string;
  name: string;
  url: string;
}

export async function fetchFacebookPublicPageFeed(feed: FeedRecord): Promise<void> {
  console.log(`[fb-public] fetching ${feed.url}`);

  const mobileUrl = toMobileUrl(feed.url);
  const result = await fetchFacebookPageHtml(mobileUrl);

  if (result.blocked || !result.html) {
    const msg =
      result.error ??
      "Facebook blocked access or returned an empty response. " +
        "Only fully public Pages/Groups are supported.";
    console.warn(`[fb-public] blocked: ${feed.url} — ${msg}`);
    await recordError(feed.id, msg);
    return;
  }

  // Second-pass login wall check using the parsed DOM (the fetcher does a
  // cheaper string-level check first to avoid unnecessary parse cost).
  if (isLoginWall(result.html)) {
    const msg =
      "Facebook requires login to view this page. Only fully public Pages/Groups are supported.";
    console.warn(`[fb-public] login wall: ${feed.url}`);
    await recordError(feed.id, msg);
    return;
  }

  const posts = parseFacebookPosts(result.html, feed.url);

  if (posts.length === 0) {
    // This happens when Facebook changed its markup or served a near-empty page.
    const msg =
      "No posts could be parsed. Facebook may have changed its markup, " +
      "or this page requires login to view posts.";
    console.warn(`[fb-public] no posts parsed: ${feed.url}`);
    await recordError(feed.id, msg);
    return;
  }

  console.log(`[fb-public] parsed ${posts.length} posts from ${feed.url}`);

  let created = 0;
  let existing = 0;

  for (const post of posts) {
    const guid = buildPostGuid(feed.id, post);

    const data = {
      feed: feed.id,
      title: post.text.slice(0, 200) || "Facebook post",
      summary: post.text.slice(0, 2000),
      content: "",
      url: post.permalink ?? feed.url,
      image_url: post.imageUrl ?? "",
      author: post.authorName ?? feed.name,
      published_at: post.timestamp ?? new Date().toISOString(),
      guid,
    };

    try {
      await pb.collection("articles").getFirstListItem(`guid="${guid}"`);
      existing++;
    } catch {
      try {
        await pb.collection("articles").create(data);
        created++;
      } catch (err) {
        console.error(`[fb-public] failed to save post ${guid}:`, err);
      }
    }
  }

  console.log(`[fb-public] ${feed.url} — created: ${created}, existing: ${existing}`);

  // Clear any previous error and record a successful fetch time.
  await pb
    .collection("feeds")
    .update(feed.id, {
      last_fetched: new Date().toISOString(),
      last_error: "",
      last_error_at: "",
    })
    .catch((err) => console.error(`[fb-public] failed to update feed ${feed.id}:`, err));
}

async function recordError(feedId: string, message: string): Promise<void> {
  await pb
    .collection("feeds")
    .update(feedId, {
      last_error: message,
      last_error_at: new Date().toISOString(),
    })
    .catch((err) => console.error(`[fb-public] failed to record error for ${feedId}:`, err));
}
