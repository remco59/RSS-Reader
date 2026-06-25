<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-6">
      <div class="flex items-center gap-2">
        <div
          v-if="category?.color"
          class="w-3 h-3 rounded-full flex-shrink-0"
          :style="`background:${category.color}`"
        />
        <h1 class="text-2xl font-bold">{{ category?.name ?? "Category" }}</h1>
      </div>
      <p class="text-sm text-gray-500 mt-0.5">Articles from your subscribed feeds in this category</p>
    </div>

    <ArticleList
      :articles="articles"
      :loading="loading"
      :total-items="totalItems"
      :total-pages="totalPages"
      :per-page="30"
      :page="page"
      :empty-message="`No articles in ${category?.name ?? 'this category'} yet.`"
      @page-change="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";
import type { Category } from "~/composables/useFeeds";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const pb = usePocketBase();
const { fetchArticles } = useArticles();
const { getMyFeeds } = useFeeds();

const category = ref<Category | null>(null);
const articles = ref<Article[]>([]);
const loading = ref(true);
const totalItems = ref(0);
const totalPages = ref(1);
const page = ref(1);
const myFeedIds = ref<string[]>([]);

async function load() {
  loading.value = true;
  try {
    const result = await fetchArticles({
      page: page.value,
      feedIds: myFeedIds.value.length ? myFeedIds.value : undefined,
      categoryId: String(route.params.id),
    });
    articles.value = result.items;
    totalItems.value = result.totalItems;
    totalPages.value = result.totalPages;
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

onMounted(async () => {
  const [userFeeds] = await Promise.all([
    getMyFeeds(),
    pb
      .collection("categories")
      .getOne<Category>(String(route.params.id))
      .then((c) => { category.value = c; })
      .catch(() => {}),
  ]);
  myFeedIds.value = userFeeds.map((uf) => uf.feed);
  await load();
});
</script>
