import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateFacebookUrl, toMobileUrl } from "../parsers/facebookSource.js";

describe("validateFacebookUrl", () => {
  // ── Valid cases ────────────────────────────────────────────────────────────

  it("accepts a plain vanity-name page URL", () => {
    const r = validateFacebookUrl("https://www.facebook.com/NASA");
    assert.equal(r.valid, true);
    assert.equal(r.type, "page");
    assert.equal(r.normalized, "https://www.facebook.com/NASA");
  });

  it("accepts a page URL without www", () => {
    const r = validateFacebookUrl("https://facebook.com/NASA");
    assert.equal(r.valid, true);
    assert.equal(r.type, "page");
  });

  it("accepts a group URL", () => {
    const r = validateFacebookUrl("https://www.facebook.com/groups/spacelovers");
    assert.equal(r.valid, true);
    assert.equal(r.type, "group");
  });

  it("accepts a group URL with numeric ID", () => {
    const r = validateFacebookUrl("https://www.facebook.com/groups/123456789");
    assert.equal(r.valid, true);
    assert.equal(r.type, "group");
  });

  it("accepts a /pages/ URL", () => {
    const r = validateFacebookUrl("https://www.facebook.com/pages/Some-Brand/123456789");
    assert.equal(r.valid, true);
    assert.equal(r.type, "page");
  });

  // ── Normalization ──────────────────────────────────────────────────────────

  it("strips query parameters", () => {
    const r = validateFacebookUrl("https://www.facebook.com/NASA?ref=ts&fref=ts");
    assert.equal(r.valid, true);
    assert.equal(r.normalized, "https://www.facebook.com/NASA");
  });

  it("strips trailing slash", () => {
    const r = validateFacebookUrl("https://www.facebook.com/NASA/");
    assert.equal(r.valid, true);
    assert.equal(r.normalized, "https://www.facebook.com/NASA");
  });

  it("upgrades http to https", () => {
    const r = validateFacebookUrl("http://www.facebook.com/NASA");
    assert.equal(r.valid, true);
    assert.match(r.normalized!, /^https:\/\//);
  });

  // ── Invalid cases ──────────────────────────────────────────────────────────

  it("rejects non-Facebook domain", () => {
    const r = validateFacebookUrl("https://twitter.com/NASA");
    assert.equal(r.valid, false);
  });

  it("rejects Facebook homepage", () => {
    const r = validateFacebookUrl("https://www.facebook.com/");
    assert.equal(r.valid, false);
  });

  it("rejects login page", () => {
    const r = validateFacebookUrl("https://www.facebook.com/login");
    assert.equal(r.valid, false);
  });

  it("rejects settings page", () => {
    const r = validateFacebookUrl("https://www.facebook.com/settings");
    assert.equal(r.valid, false);
  });

  it("rejects profile.php", () => {
    const r = validateFacebookUrl("https://www.facebook.com/profile.php?id=123456");
    assert.equal(r.valid, false);
  });

  it("rejects a bare invalid string", () => {
    const r = validateFacebookUrl("not a url at all");
    assert.equal(r.valid, false);
  });

  it("rejects an empty string", () => {
    const r = validateFacebookUrl("");
    assert.equal(r.valid, false);
  });
});

describe("toMobileUrl", () => {
  it("converts www.facebook.com to m.facebook.com", () => {
    const m = toMobileUrl("https://www.facebook.com/NASA");
    assert.equal(m, "https://m.facebook.com/NASA");
  });

  it("preserves path when converting to mobile", () => {
    const m = toMobileUrl("https://www.facebook.com/groups/spacelovers");
    assert.equal(m, "https://m.facebook.com/groups/spacelovers");
  });
});
