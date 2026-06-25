import type { Article } from "./useArticles";

export function useRealtimeArticles(onNew: (article: Article) => void) {
  const pb = usePocketBase();
  let unsub: (() => void) | null = null;

  onMounted(async () => {
    unsub = await pb.collection("articles").subscribe<Article>("*", (e) => {
      if (e.action === "create") {
        onNew(e.record);
      }
    });
  });

  onUnmounted(() => {
    unsub?.();
  });
}
