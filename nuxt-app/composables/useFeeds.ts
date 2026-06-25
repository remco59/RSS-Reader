export interface Feed {
  id: string;
  name: string;
  url: string;
  type: "rss" | "instagram" | "facebook" | "youtube" | "scrape";
  category: string;
  description: string;
  favicon: string;
  fetch_interval_mins: number;
  last_fetched: string;
  is_active: boolean;
  scrape_config?: string | null;
  expand?: { category?: Category };
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  user: string;
}

export interface UserFeed {
  id: string;
  user: string;
  feed: string;
  alias: string;
  expand?: { feed?: Feed };
}

export function useFeeds() {
  const pb = usePocketBase();
  const { user } = useAuth();

  async function getMyFeeds(): Promise<UserFeed[]> {
    if (!user.value) return [];
    return pb.collection("user_feeds").getFullList<UserFeed>({
      filter: `user = "${user.value.id}"`,
      expand: "feed,feed.category",
      sort: "alias,feed.name",
    });
  }

  async function getAllFeeds(): Promise<Feed[]> {
    return pb.collection("feeds").getFullList<Feed>({
      expand: "category",
      sort: "name",
    });
  }

  async function subscribe(feedId: string) {
    if (!user.value) return;
    await pb.collection("user_feeds").create({
      user: user.value.id,
      feed: feedId,
      alias: "",
    });
  }

  async function unsubscribe(userFeedId: string) {
    await pb.collection("user_feeds").delete(userFeedId);
  }

  async function addFeed(data: {
    name: string;
    url: string;
    type: Feed["type"];
    category?: string;
    description?: string;
    favicon?: string;
    scrape_config?: Record<string, string> | null;
  }) {
    let feed: Feed;
    try {
      feed = await pb.collection("feeds").create<Feed>({
        ...data,
        scrape_config: data.scrape_config ? JSON.stringify(data.scrape_config) : undefined,
        fetch_interval_mins: 60,
        is_active: true,
      });
    } catch (err: any) {
      // URL already exists — find and subscribe to the existing feed
      if (err?.status === 400 && err?.data?.url) {
        const escapedUrl = data.url.replace(/'/g, "\\'");
        feed = await pb.collection("feeds").getFirstListItem<Feed>(`url = '${escapedUrl}'`);
      } else {
        throw err;
      }
    }

    try {
      await subscribe(feed.id);
    } catch (err: any) {
      if (err?.status === 400) {
        throw new Error("You're already subscribed to this feed.");
      }
      throw err;
    }

    return feed;
  }

  async function getCategories(): Promise<Category[]> {
    if (!user.value) return [];
    return pb.collection("categories").getFullList<Category>({
      filter: `user = "" || user = "${user.value.id}"`,
      sort: "name",
    });
  }

  async function addCategory(data: { name: string; color?: string; icon?: string }): Promise<Category | undefined> {
    if (!user.value) return;
    return pb.collection("categories").create<Category>({
      ...data,
      user: user.value.id,
    });
  }

  async function deleteCategory(id: string) {
    await pb.collection("categories").delete(id);
  }

  async function updateFeed(
    feedId: string,
    data: Partial<Pick<Feed, "name" | "category" | "description" | "favicon" | "fetch_interval_mins" | "is_active">>,
  ) {
    return pb.collection("feeds").update<Feed>(feedId, data);
  }

  async function updateUserFeed(userFeedId: string, data: { alias: string }) {
    return pb.collection("user_feeds").update<UserFeed>(userFeedId, data);
  }

  return { getMyFeeds, getAllFeeds, subscribe, unsubscribe, addFeed, getCategories, addCategory, deleteCategory, updateFeed, updateUserFeed };
}
