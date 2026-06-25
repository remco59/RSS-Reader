<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">For You</h1>
        <p class="text-sm text-gray-500 mt-0.5">Latest from your subscribed feeds</p>
      </div>
      <UButton
        icon="i-heroicons-arrow-path"
        variant="ghost"
        color="neutral"
        :loading="loading"
        label="Refresh"
        @click="load"
      />
    </div>

    <!-- Category filter chips -->
    <div v-if="categories.length" class="flex gap-2 flex-wrap mb-6">
      <UButton
        size="sm"
        :variant="activeCategory === '' ? 'solid' : 'outline'"
        color="primary"
        label="All"
        @click="activeCategory = ''"
      />
      <UButton
        v-for="cat in categories"
        :key="cat.id"
        size="sm"
        :variant="activeCategory === cat.id ? 'solid' : 'outline'"
        color="primary"
        :label="cat.name"
        @click="activeCategory = cat.id"
      />
    </div>

    <ArticleList
      :articles="articles"
      :loading="loading"
      :total-items="totalItems"
      :total-pages="totalPages"
      :per-page="30"
      :page="page"
      empty-message="Subscribe to feeds in settings to get started."
      @page-change="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";
import type { Category } from "~/composables/useFeeds";

definePageMeta({ middleware: "auth" });

const { fetchArticles } = useArticles();
const { getMyFeeds, getCategories } = useFeeds();

const articles = ref<Article[]>([]);
const loading = ref(true);
const totalItems = ref(0);
const totalPages = ref(1);
const page = ref(1);
const activeCategory = ref("");
const categories = ref<Category[]>([]);

// IDs of the feeds this user is subscribed to
const myFeedIds = ref<string[]>([]);

async function load() {
  loading.value = true;
  try {
    const userFeeds = await getMyFeeds();
    myFeedIds.value = userFeeds.map((uf) => uf.feed);

    if (!myFeedIds.value.length) {
      articles.value = [];
      loading.value = false;
      return;
    }

    const result = await fetchArticles({
      page: page.value,
      feedIds: myFeedIds.value,
      categoryId: activeCategory.value || undefined,
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

watch(activeCategory, () => {
  page.value = 1;
  load();
});

onMounted(async () => {
  categories.value = await getCategories();
  await load();
});
</script>
