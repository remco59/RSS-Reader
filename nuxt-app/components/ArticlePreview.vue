<template>
  <div class="h-full overflow-y-auto">
    <!-- Empty state -->
    <div v-if="!article" class="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
      <UIcon name="i-heroicons-newspaper" class="text-4xl" />
      <p class="text-sm">Select an article to preview</p>
    </div>

    <!-- Article content -->
    <div v-else class="p-6 max-w-2xl mx-auto">
      <!-- Feed meta -->
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <img
          v-if="feed?.favicon"
          :src="feed.favicon"
          class="w-4 h-4 rounded"
          :alt="feed.name"
        />
        <span class="text-sm text-primary-600 dark:text-primary-400 font-medium">
          {{ feed?.name ?? "Unknown" }}
        </span>
        <span class="text-gray-300 dark:text-gray-600">·</span>
        <span class="text-sm text-gray-400">{{ formattedDate }}</span>
        <template v-if="article.author">
          <span class="text-gray-300 dark:text-gray-600">·</span>
          <span class="text-sm text-gray-400">{{ article.author }}</span>
        </template>
      </div>

      <!-- Title -->
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-4">
        {{ article.title }}
      </h1>

      <!-- Actions -->
      <div class="flex items-center gap-2 mb-5 pb-4 border-b border-gray-200 dark:border-gray-800 flex-wrap">
        <UButton
          size="sm"
          :icon="article.read_at ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
          :color="article.read_at ? 'neutral' : 'primary'"
          :variant="article.read_at ? 'outline' : 'solid'"
          :label="article.read_at ? 'Mark unread' : 'Mark as read'"
          @click="emit('mark-read', article)"
        />
        <UButton
          size="sm"
          :icon="article.bookmarked_at ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'"
          :color="article.bookmarked_at ? 'primary' : 'neutral'"
          :variant="article.bookmarked_at ? 'solid' : 'outline'"
          :label="article.bookmarked_at ? 'Bookmarked' : 'Bookmark'"
          @click="emit('toggle-bookmark', article)"
        />
        <div class="flex-1" />
        <UButton
          size="sm"
          icon="i-heroicons-arrow-top-right-on-square"
          variant="outline"
          color="neutral"
          label="Open original"
          :to="article.url"
          target="_blank"
          rel="noopener noreferrer"
        />
      </div>

      <!-- Hero image -->
      <div
        v-if="article.image_url"
        class="mb-5 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
      >
        <img
          :src="article.image_url"
          :alt="article.title"
          class="w-full object-cover max-h-64"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
      </div>

      <!-- Content loading skeleton -->
      <div v-if="contentLoading" class="space-y-3 animate-pulse">
        <div
          v-for="i in 8"
          :key="i"
          class="h-4 bg-gray-200 dark:bg-gray-800 rounded"
          :class="i % 3 === 0 ? 'w-2/3' : 'w-full'"
        />
      </div>

      <!-- Full fetched content -->
      <div
        v-else-if="fetchedContent"
        class="prose prose-sm dark:prose-invert max-w-none"
        v-html="fetchedContent"
      />

      <!-- RSS summary fallback -->
      <div
        v-else-if="article.summary"
        class="prose prose-sm dark:prose-invert max-w-none"
        v-html="sanitizedSummary"
      />

      <!-- No content -->
      <div v-else class="flex flex-col items-center py-12 text-center text-gray-400">
        <UIcon name="i-heroicons-document-text" class="text-3xl mb-2" />
        <p class="text-sm">No preview available</p>
        <UButton
          class="mt-3"
          size="sm"
          icon="i-heroicons-arrow-top-right-on-square"
          label="Open original"
          :to="article.url"
          target="_blank"
          rel="noopener noreferrer"
        />
      </div>

      <p v-if="contentSource && !contentLoading" class="mt-8 text-xs text-gray-400 text-center">
        <span v-if="contentSource === 'direct'">Full article fetched from original source</span>
        <span v-else-if="contentSource === 'archive'">Content loaded via archive.ph</span>
        <span v-else-if="contentSource === 'rss'">Preview from RSS feed</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

const props = defineProps<{ article: Article | null }>();
const emit = defineEmits<{
  "mark-read": [article: Article];
  "toggle-bookmark": [article: Article];
}>();

const contentLoading = ref(false);
const fetchedContent = ref<string | null>(null);
const contentSource = ref<"direct" | "archive" | "rss" | null>(null);

const feed = computed(() => props.article?.expand?.feed);

const formattedDate = computed(() => {
  if (!props.article?.published_at) return "";
  return new Date(props.article.published_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

const sanitizedSummary = computed(() => {
  if (!props.article?.summary) return "";
  return props.article.summary
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
});

watch(
  () => props.article,
  async (article) => {
    fetchedContent.value = null;
    contentSource.value = null;
    if (!article?.url) return;

    contentLoading.value = true;
    try {
      const data = await $fetch<{ content: string | null; source: string }>(
        "/api/fetch-article",
        { query: { url: article.url } }
      );
      if (data.content) {
        fetchedContent.value = data.content;
        contentSource.value = data.source as "direct" | "archive";
      } else {
        contentSource.value = article.summary ? "rss" : null;
      }
    } catch {
      contentSource.value = article.summary ? "rss" : null;
    } finally {
      contentLoading.value = false;
    }
  },
  { immediate: true }
);
</script>
