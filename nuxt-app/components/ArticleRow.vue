<template>
  <div
    class="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer transition-colors"
    :class="[
      selected
        ? 'bg-primary-50 dark:bg-primary-900/20'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      article.read_at ? 'opacity-60' : '',
    ]"
    @click="emit('click', article)"
  >
    <img
      v-if="feed?.favicon"
      :src="feed.favicon"
      class="w-4 h-4 rounded mt-0.5 flex-shrink-0"
      :alt="feed.name"
    />
    <UIcon v-else name="i-heroicons-rss" class="text-gray-400 text-sm mt-0.5 flex-shrink-0" />

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5 mb-0.5">
        <span class="text-xs text-gray-400 truncate">{{ feed?.name ?? "Unknown" }}</span>
        <span class="text-xs text-gray-300 dark:text-gray-600 flex-shrink-0">·</span>
        <span class="text-xs text-gray-400 flex-shrink-0">{{ timeAgo }}</span>
      </div>
      <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
        {{ article.title }}
      </p>
      <p v-if="plainSummary" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
        {{ plainSummary }}
      </p>
    </div>

    <UButton
      size="xs"
      variant="ghost"
      :icon="article.bookmarked_at ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'"
      :color="article.bookmarked_at ? 'primary' : 'neutral'"
      class="flex-shrink-0 mt-0.5"
      @click.stop="emit('toggle-bookmark', article)"
    />
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

const props = defineProps<{
  article: Article;
  selected?: boolean;
}>();

const emit = defineEmits<{
  click: [article: Article];
  "toggle-bookmark": [article: Article];
}>();

const feed = computed(() => props.article.expand?.feed);

const timeAgo = computed(() => {
  if (!props.article.published_at) return "";
  const diff = Date.now() - new Date(props.article.published_at).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
});

const plainSummary = computed(() =>
  props.article.summary?.replace(/<[^>]*>/g, "").trim() ?? ""
);
</script>
