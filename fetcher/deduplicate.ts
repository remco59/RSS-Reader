/**
 * One-time deduplication script: finds articles with the same URL stored under
 * multiple feeds, keeps the oldest record, migrates user_articles state to it,
 * then deletes the duplicates.
 *
 * Run with:
 *   PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... POCKETBASE_URL=... node --import tsx/esm deduplicate.ts
 */

import { authenticate, pb } from "./pb.js";

interface Article {
  id: string;
  url: string;
  title: string;
  created: string;
}

interface UserArticle {
  id: string;
  user: string;
  article: string;
  read_at: string;
  bookmarked_at: string;
}

async function main() {
  await authenticate();

  console.log("[dedup] loading all articles...");
  const all = await pb.collection("articles").getFullList<Article>({
    sort: "+id",
  });
  console.log(`[dedup] loaded ${all.length} articles`);

  // Group by URL
  const byUrl = new Map<string, Article[]>();
  for (const article of all) {
    if (!article.url) continue;
    const group = byUrl.get(article.url) ?? [];
    group.push(article);
    byUrl.set(article.url, group);
  }

  const dupeGroups = [...byUrl.values()].filter((g) => g.length > 1);
  console.log(`[dedup] found ${dupeGroups.length} URLs with duplicates`);

  if (dupeGroups.length === 0) {
    console.log("[dedup] nothing to do");
    return;
  }

  let totalDeleted = 0;
  let totalMigrated = 0;

  for (const group of dupeGroups) {
    // Already sorted oldest-first; the first entry is the winner
    const [winner, ...dupes] = group;
    console.log(`\n[dedup] "${winner.title.slice(0, 60)}" — keeping ${winner.id}, removing ${dupes.map((d) => d.id).join(", ")}`);

    for (const dupe of dupes) {
      // Load user_articles for this duplicate
      let userArticles: UserArticle[] = [];
      try {
        userArticles = await pb.collection("user_articles").getFullList<UserArticle>({
          filter: `article = "${dupe.id}"`,
        });
      } catch {
        // none
      }

      for (const ua of userArticles) {
        // Try to update the user_article to point to the winner
        try {
          await pb.collection("user_articles").update(ua.id, { article: winner.id });
          totalMigrated++;
        } catch {
          // Unique constraint: this user already has a user_article for the winner.
          // Merge state: if dupe is read/bookmarked but winner's record isn't, update winner's record.
          try {
            const winnerUa = await pb
              .collection("user_articles")
              .getFirstListItem<UserArticle>(`user = "${ua.user}" && article = "${winner.id}"`);

            const patch: Partial<UserArticle> = {};
            if (ua.read_at && !winnerUa.read_at) patch.read_at = ua.read_at;
            if (ua.bookmarked_at && !winnerUa.bookmarked_at) patch.bookmarked_at = ua.bookmarked_at;
            if (Object.keys(patch).length) {
              await pb.collection("user_articles").update(winnerUa.id, patch);
              console.log(`  [dedup] merged read/bookmark state for user ${ua.user}`);
            }
          } catch {
            // ignore — winner's user_article already has the right state
          }
          // Delete the conflicting user_article so cascade delete won't fail
          try {
            await pb.collection("user_articles").delete(ua.id);
          } catch {
            // ignore
          }
        }
      }

      // Delete the duplicate article (cascadeDelete handles any remaining user_articles)
      try {
        await pb.collection("articles").delete(dupe.id);
        totalDeleted++;
        console.log(`  [dedup] deleted article ${dupe.id}`);
      } catch (err) {
        console.error(`  [dedup] failed to delete article ${dupe.id}:`, err);
      }
    }
  }

  console.log(`\n[dedup] done — deleted ${totalDeleted} duplicate articles, migrated ${totalMigrated} user_articles records`);
}

main().catch((err) => {
  console.error("[dedup] fatal:", err);
  process.exit(1);
});
