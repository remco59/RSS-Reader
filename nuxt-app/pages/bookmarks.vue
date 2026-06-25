<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Bookmarks</h1>
      <p class="text-sm text-gray-500 mt-0.5">Articles you saved for later</p>
    </div>

    <ArticleList
      :articles="articles"
      :loading="loading"
      :total-items="totalItems"
      :total-pages="totalPages"
      :per-page="30"
      :page="page"
      empty-message="Bookmark articles while reading to save them here."
      @page-change="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

definePageMeta({ middleware: "auth" });

const { fetchArticles } = useArticles();
const articles = ref<Article[]>([]);
const loading = ref(true);
const totalItems = ref(0);
const totalPages = ref(1);
const page = ref(1);

async function load() {
  loading.value = true;
  try {
    const result = await fetchArticles({ onlyBookmarks: true, page: page.value });
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

onMounted(load);
</script>
