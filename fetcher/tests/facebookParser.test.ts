import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFacebookPosts,
  isLoginWall,
  buildPostGuid,
} from "../parsers/facebookParser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

// ─── isLoginWall ──────────────────────────────────────────────────────────────

describe("isLoginWall", () => {
  it("detects the login wall fixture", () => {
    assert.equal(isLoginWall(fixture("fb_login_wall.html")), true);
  });

  it("does not flag a public page as a login wall", () => {
    assert.equal(isLoginWall(fixture("fb_public_page.html")), false);
  });

  it("does not flag OG-only page as a login wall", () => {
    assert.equal(isLoginWall(fixture("fb_og_only.html")), false);
  });
});

// ─── parseFacebookPosts ───────────────────────────────────────────────────────

describe("parseFacebookPosts — public page fixture", () => {
  const posts = parseFacebookPosts(
    fixture("fb_public_page.html"),
    "https://www.facebook.com/NASA"
  );

  it("parses at least one post", () => {
    assert.ok(posts.length >= 1, `expected >= 1 post, got ${posts.length}`);
  });

  it("post text is non-empty", () => {
    for (const p of posts) {
      assert.ok(p.text.length > 0, "post text should not be empty");
    }
  });

  it("at least one post has a timestamp from data-store", () => {
    const withTs = posts.find((p) => p.timestamp !== undefined);
    assert.ok(withTs, "expected at least one post with a parsed timestamp");
    // Verify it's a valid ISO-8601 date
    assert.ok(!isNaN(new Date(withTs!.timestamp!).getTime()));
  });

  it("at least one post has a permalink", () => {
    const withLink = posts.find((p) => p.permalink !== undefined);
    assert.ok(withLink, "expected at least one post with a permalink");
    assert.match(withLink!.permalink!, /^https?:\/\//);
  });

  it("no duplicate posts in output", () => {
    const permalinks = posts.map((p) => p.permalink).filter(Boolean);
    const unique = new Set(permalinks);
    assert.equal(unique.size, permalinks.length, "parseFacebookPosts should deduplicate");
  });
});

describe("parseFacebookPosts — OG-only fixture", () => {
  it("falls back to Open Graph data when no story containers found", () => {
    const posts = parseFacebookPosts(
      fixture("fb_og_only.html"),
      "https://www.facebook.com/SomeOrg"
    );
    assert.ok(posts.length >= 1, "should produce at least one OG-based post");
    assert.ok(posts[0].text.length > 0);
  });
});

describe("parseFacebookPosts — login wall fixture", () => {
  it("returns an array (may be empty or have OG fallback) without throwing", () => {
    const posts = parseFacebookPosts(
      fixture("fb_login_wall.html"),
      "https://www.facebook.com/SomePage"
    );
    assert.ok(Array.isArray(posts));
    // The caller checks isLoginWall() separately before trusting the parsed posts
  });
});

// ─── buildPostGuid ────────────────────────────────────────────────────────────

describe("buildPostGuid", () => {
  it("produces the same GUID for the same permalink twice (stability)", () => {
    const post = { text: "x", permalink: "https://www.facebook.com/story.php?story_fbid=123&id=456" };
    assert.equal(buildPostGuid("feed1", post), buildPostGuid("feed1", post));
  });

  it("produces different GUIDs for different feed IDs", () => {
    const post = { text: "x", permalink: "https://www.facebook.com/story.php?story_fbid=123&id=456" };
    assert.notEqual(buildPostGuid("feedA", post), buildPostGuid("feedB", post));
  });

  it("normalizes mobile and desktop permalink to the same GUID", () => {
    const mobile = { text: "x", permalink: "https://m.facebook.com/story.php?story_fbid=999&id=111" };
    const desktop = { text: "x", permalink: "https://www.facebook.com/story.php?story_fbid=999&id=111" };
    assert.equal(buildPostGuid("feed1", mobile), buildPostGuid("feed1", desktop));
  });

  it("strips fbclid tracking param so same post URL produces the same GUID", () => {
    const withTracker = {
      text: "x",
      permalink: "https://www.facebook.com/story.php?story_fbid=123&id=456&fbclid=IwAR0abc",
    };
    const clean = {
      text: "x",
      permalink: "https://www.facebook.com/story.php?story_fbid=123&id=456",
    };
    assert.equal(buildPostGuid("feed1", withTracker), buildPostGuid("feed1", clean));
  });

  it("falls back to text hash when no permalink provided (stability)", () => {
    const post = { text: "Consistent post text used for hashing" };
    assert.equal(buildPostGuid("feed1", post), buildPostGuid("feed1", post));
  });

  it("text-hash GUIDs differ for different texts", () => {
    const a = { text: "Post about the moon" };
    const b = { text: "Post about the sun" };
    assert.notEqual(buildPostGuid("feed1", a), buildPostGuid("feed1", b));
  });
});
