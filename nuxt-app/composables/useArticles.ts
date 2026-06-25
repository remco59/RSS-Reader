export interface Article {
  id: string;
  feed: string;
  title: string;
  summary: string;
  url: string;
  image_url: string;
  author: string;
  published_at: string;
  expand?: {
    feed?: { id: string; name: string; favicon: string; type: string };
  };
  // from user_articles join (populated separately)
  read_at?: string;
  bookmarked_at?: string;
  userArticleId?: string;
}

export interface UserArticle {
  id: string;
  user: string;
  article: string;
  read_at: string;
  bookmarked_at: string;
}

export function useArticles() {
  const pb = usePocketBase();
  const { user } = useAuth();

  async function fetchArticles(options: {
    feedId?: string;
    feedIds?: string[];
    categoryId?: string;
    onlyBookmarks?: boolean;
    search?: string;
    page?: number;
    perPage?: number;
  } = {}): Promise<{ items: Article[]; totalItems: number; totalPages: number }> {
    const { page = 1, perPage = 30 } = options;

    if (options.onlyBookmarks) {
      if (!user.value) return { items: [], totalItems: 0, totalPages: 0 };

      const uaResult = await pb.collection("user_articles").getList<UserArticle>(page, perPage, {
        filter: `user = "${user.value.id}" && bookmarked_at != ""`,
        sort: "-bookmarked_at",
      });

      if (uaResult.items.length === 0) {
        return { items: [], totalItems: uaResult.totalItems, totalPages: uaResult.totalPages };
      }

      const articleIds = uaResult.items.map((ua) => ua.article);
      const idFilter = articleIds.map((id) => `id = "${id}"`).join(" || ");
      const articlesList = await pb.collection("articles").getFullList<Article>({
        filter: idFilter,
        expand: "feed",
      });

      const byArticleId = new Map(uaResult.items.map((ua) => [ua.article, ua]));
      for (const article of articlesList) {
        const ua = byArticleId.get(article.id);
        if (ua) {
          article.read_at = ua.read_at;
          article.bookmarked_at = ua.bookmarked_at;
          article.userArticleId = ua.id;
        }
      }

      // Preserve bookmark order from user_articles query
      const sorted = articleIds.map((id) => articlesList.find((a) => a.id === id)!).filter(Boolean);
      return { items: sorted, totalItems: uaResult.totalItems, totalPages: uaResult.totalPages };
    }

    let filter = "";
    const filters: string[] = [];

    if (options.feedId) {
      filters.push(`feed = "${options.feedId}"`);
    } else if (options.feedIds?.length) {
      filters.push(`(${options.feedIds.map((id) => `feed = "${id}"`).join(" || ")})`);
    }

    if (options.categoryId) {
      filters.push(`feed.category = "${options.categoryId}"`);
    }

    if (options.search) {
      const q = options.search.replace(/"/g, "");
      filters.push(`(title ~ "${q}" || summary ~ "${q}")`);
    }

    if (filters.length) filter = filters.join(" && ");

    const result = await pb.collection("articles").getList<Article>(page, perPage, {
      filter: filter || undefined,
      sort: "-published_at",
      expand: "feed",
    });

    if (!user.value) return result;

    // Overlay user_articles state
    const articleIds = result.items.map((a) => a.id);
    if (articleIds.length) {
      const idFilter = articleIds.map((id) => `article = "${id}"`).join(" || ");
      const userArticles = await pb
        .collection("user_articles")
        .getFullList<UserArticle>({
          filter: `user = "${user.value.id}" && (${idFilter})`,
        })
        .catch(() => [] as UserArticle[]);

      const byArticleId = new Map(userArticles.map((ua) => [ua.article, ua]));
      for (const article of result.items) {
        const ua = byArticleId.get(article.id);
        if (ua) {
          article.read_at = ua.read_at;
          article.bookmarked_at = ua.bookmarked_at;
          article.userArticleId = ua.id;
        }
      }
    }

    return result;
  }

  async function toggleRead(articleId: string, userArticleId?: string, currentRead?: string) {
    if (!user.value) return;
    const read_at = currentRead ? "" : new Date().toISOString();
    if (userArticleId) {
      await pb.collection("user_articles").update(userArticleId, { read_at });
    } else {
      await pb.collection("user_articles").create({
        user: user.value.id,
        article: articleId,
        read_at,
        bookmarked_at: "",
      });
    }
  }

  async function toggleBookmark(articleId: string, userArticleId?: string, currentBookmark?: string) {
    if (!user.value) return;
    const bookmarked_at = currentBookmark ? "" : new Date().toISOString();
    if (userArticleId) {
      await pb.collection("user_articles").update(userArticleId, { bookmarked_at });
    } else {
      await pb.collection("user_articles").create({
        user: user.value.id,
        article: articleId,
        read_at: "",
        bookmarked_at,
      });
    }
  }

  return { fetchArticles, toggleRead, toggleBookmark };
}
