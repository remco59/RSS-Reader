<template>
  <div
    class="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    :class="{ 'opacity-60': article.read_at }"
    @click="openArticle"
  >
    <!-- Image -->
    <div v-if="article.image_url" class="aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800">
      <img
        :src="article.image_url"
        :alt="article.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>

    <div class="p-4">
      <!-- Feed + date -->
      <div class="flex items-center gap-2 mb-2">
        <img
          v-if="feed?.favicon"
          :src="feed.favicon"
          class="w-4 h-4 rounded"
          :alt="feed.name"
        />
        <span class="text-xs text-gray-400 truncate">{{ feed?.name ?? "Unknown" }}</span>
        <span class="text-xs text-gray-300 dark:text-gray-600">·</span>
        <span class="text-xs text-gray-400">{{ timeAgo }}</span>
      </div>

      <!-- Title -->
      <h3 class="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2 mb-1">
        {{ article.title }}
      </h3>

      <!-- Summary -->
      <p v-if="article.summary" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
        {{ article.summary }}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <UButton
          size="xs"
          variant="ghost"
          :icon="article.read_at ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
          :color="article.read_at ? 'neutral' : 'primary'"
          :label="article.read_at ? 'Read' : 'Mark read'"
          @click.stop="emit('mark-read', article)"
        />
        <UButton
          size="xs"
          variant="ghost"
          :icon="article.bookmarked_at ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'"
          :color="article.bookmarked_at ? 'primary' : 'neutral'"
          @click.stop="emit('toggle-bookmark', article)"
        />
        <div class="flex-1" />
        <UButton
          size="xs"
          variant="ghost"
          icon="i-heroicons-arrow-top-right-on-square"
          color="neutral"
          :to="article.url"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

const props = defineProps<{ article: Article }>();
const emit = defineEmits<{
  "mark-read": [article: Article];
  "toggle-bookmark": [article: Article];
}>();

const feed = computed(() => props.article.expand?.feed);

const timeAgo = computed(() => {
  if (!props.article.published_at) return "";
  const diff = Date.now() - new Date(props.article.published_at).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
});

const router = useRouter();

function openArticle() {
  router.push(`/article/${props.article.id}`);
}
</script>
