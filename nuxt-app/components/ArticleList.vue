<template>
  <div>
    <!-- View toggle -->
    <div class="flex items-center justify-end mb-4">
      <div class="inline-flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          v-for="opt in viewOptions"
          :key="opt.value"
          class="p-1.5 transition-colors"
          :class="
            view === opt.value
              ? 'bg-primary-500 text-white'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          "
          :title="opt.label"
          @click="setView(opt.value)"
        >
          <UIcon :name="opt.icon" class="text-base" />
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-if="view === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="i in 9"
          :key="i"
          class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-pulse"
        >
          <div class="aspect-video bg-gray-200 dark:bg-gray-800" />
          <div class="p-4 space-y-2">
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        </div>
      </div>
      <div
        v-else
        class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
      >
        <div
          v-for="i in 10"
          :key="i"
          class="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 animate-pulse"
        >
          <div class="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 mt-0.5 flex-shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        </div>
      </div>
    </template>

    <!-- Grid view -->
    <template v-else-if="view === 'grid'">
      <div v-if="articles.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <ArticleCard
          v-for="article in articles"
          :key="article.id"
          :article="article"
          @mark-read="handleMarkRead"
          @toggle-bookmark="handleToggleBookmark"
        />
      </div>
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <UIcon name="i-heroicons-newspaper" class="text-5xl text-gray-300 dark:text-gray-700 mb-4" />
        <p class="text-gray-500 dark:text-gray-400 font-medium">No articles yet</p>
        <p class="text-gray-400 dark:text-gray-600 text-sm mt-1">{{ emptyMessage }}</p>
      </div>
    </template>

    <!-- List view -->
    <template v-else-if="view === 'list'">
      <div
        v-if="articles.length"
        class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900"
      >
        <ArticleRow
          v-for="article in articles"
          :key="article.id"
          :article="article"
          @click="navigateToArticle"
          @toggle-bookmark="handleToggleBookmark"
        />
      </div>
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <UIcon name="i-heroicons-newspaper" class="text-5xl text-gray-300 dark:text-gray-700 mb-4" />
        <p class="text-gray-500 dark:text-gray-400 font-medium">No articles yet</p>
        <p class="text-gray-400 dark:text-gray-600 text-sm mt-1">{{ emptyMessage }}</p>
      </div>
    </template>

    <!-- Split view -->
    <template v-else-if="view === 'split'">
      <div
        v-if="articles.length"
        class="flex border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden h-[calc(100dvh-220px)] min-h-96"
      >
        <!-- Left: article list -->
        <div
          class="w-72 xl:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-900"
        >
          <ArticleRow
            v-for="article in articles"
            :key="article.id"
            :article="article"
            :selected="selectedArticle?.id === article.id"
            @click="selectArticle"
            @toggle-bookmark="handleToggleBookmark"
          />
        </div>

        <!-- Right: preview -->
        <div class="flex-1 overflow-hidden bg-white dark:bg-gray-900">
          <ArticlePreview
            :article="selectedArticle"
            @mark-read="handleMarkRead"
            @toggle-bookmark="handleToggleBookmark"
          />
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <UIcon name="i-heroicons-newspaper" class="text-5xl text-gray-300 dark:text-gray-700 mb-4" />
        <p class="text-gray-500 dark:text-gray-400 font-medium">No articles yet</p>
        <p class="text-gray-400 dark:text-gray-600 text-sm mt-1">{{ emptyMessage }}</p>
      </div>
    </template>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center mt-8">
      <UPagination
        v-model:page="currentPage"
        :total="totalItems ?? 0"
        :items-per-page="perPage ?? 30"
        @update:page="emit('page-change', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

const props = defineProps<{
  articles: Article[];
  loading?: boolean;
  totalItems?: number;
  totalPages?: number;
  perPage?: number;
  page?: number;
  emptyMessage?: string;
}>();

const emit = defineEmits<{
  "page-change": [page: number];
  "mark-read": [article: Article];
  "toggle-bookmark": [article: Article];
}>();

const currentPage = defineModel<number>("page", { default: 1 });
const { toggleRead, toggleBookmark } = useArticles();
const { view, setView } = useViewPreference();

const selectedArticle = ref<Article | null>(null);

const viewOptions = [
  { value: "grid" as const, icon: "i-heroicons-squares-2x2", label: "Grid view" },
  { value: "list" as const, icon: "i-heroicons-list-bullet", label: "List view" },
  { value: "split" as const, icon: "i-heroicons-rectangle-group", label: "Split view" },
];

async function handleMarkRead(article: Article) {
  await toggleRead(article.id, article.userArticleId, article.read_at);
  article.read_at = article.read_at ? "" : new Date().toISOString();
}

async function handleToggleBookmark(article: Article) {
  await toggleBookmark(article.id, article.userArticleId, article.bookmarked_at);
  article.bookmarked_at = article.bookmarked_at ? "" : new Date().toISOString();
}

function navigateToArticle(article: Article) {
  useRouter().push(`/article/${article.id}`);
}

async function selectArticle(article: Article) {
  selectedArticle.value = article;
  if (!article.read_at) {
    await handleMarkRead(article);
  }
}

// Reset selection when articles change (page/filter change)
watch(
  () => props.articles,
  (articles) => {
    if (view.value === "split") {
      selectedArticle.value = articles.length ? articles[0] : null;
    }
  }
);
</script>
