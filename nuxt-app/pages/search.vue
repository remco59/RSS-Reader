<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Search</h1>
    </div>

    <div class="mb-6 max-w-xl">
      <UInput
        v-model="query"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search articles..."
        size="lg"
        class="w-full"
        @keyup.enter="search"
      >
        <template #trailing>
          <UButton
            v-if="query"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            @click="query = ''; articles = []"
          />
        </template>
      </UInput>
    </div>

    <p v-if="searched && !loading && query" class="text-sm text-gray-500 mb-4">
      {{ totalItems }} result{{ totalItems !== 1 ? "s" : "" }} for "<strong>{{ lastQuery }}</strong>"
    </p>

    <ArticleList
      :articles="articles"
      :loading="loading"
      :total-items="totalItems"
      :total-pages="totalPages"
      :per-page="30"
      :page="page"
      empty-message="Try searching for a topic, author, or keyword."
      @page-change="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

definePageMeta({ middleware: "auth" });

const { fetchArticles } = useArticles();
const query = ref("");
const lastQuery = ref("");
const articles = ref<Article[]>([]);
const loading = ref(false);
const totalItems = ref(0);
const totalPages = ref(1);
const page = ref(1);
const searched = ref(false);

const debouncedSearch = useDebounceFn(search, 400);
watch(query, () => {
  if (query.value.length >= 2) debouncedSearch();
});

async function search() {
  if (!query.value.trim()) return;
  loading.value = true;
  searched.value = true;
  lastQuery.value = query.value;
  try {
    const result = await fetchArticles({ search: query.value, page: page.value });
    articles.value = result.items;
    totalItems.value = result.totalItems;
    totalPages.value = result.totalPages;
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  search();
}
</script>
