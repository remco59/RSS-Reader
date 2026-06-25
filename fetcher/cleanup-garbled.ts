import { pb, authenticate } from "./pb.js";

const GARBLED_PATTERN = /\w+=""/;

async function deleteGarbledArticles() {
  await authenticate();

  let page = 1;
  let deleted = 0;

  while (true) {
    const result = await pb.collection("articles").getList(page, 200, {
      sort: "-created",
    });

    if (result.items.length === 0) break;

    for (const article of result.items) {
      if (GARBLED_PATTERN.test(article.title) || GARBLED_PATTERN.test(article.summary)) {
        await pb.collection("articles").delete(article.id);
        console.log(`[cleanup] deleted: ${article.title.slice(0, 60)}`);
        deleted++;
      }
    }

    if (page >= result.totalPages) break;
    page++;
  }

  console.log(`[cleanup] done — deleted ${deleted} garbled articles`);
}

deleteGarbledArticles().catch(console.error);
