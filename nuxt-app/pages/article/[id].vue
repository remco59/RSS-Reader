<template>
  <div class="p-6 max-w-3xl mx-auto">
    <!-- Back button -->
    <div class="mb-6">
      <UButton
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        label="Back"
        @click="$router.back()"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4 animate-pulse">
      <div class="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
      <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded w-full" />
      <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
      <div class="aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl" />
      <div class="space-y-2">
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center py-24 text-center">
      <UIcon name="i-heroicons-exclamation-triangle" class="text-5xl text-red-400 mb-4" />
      <p class="font-medium text-gray-700 dark:text-gray-300">Article not found</p>
      <UButton class="mt-4" label="Go home" to="/" />
    </div>

    <!-- Article -->
    <article v-else-if="article">
      <!-- Feed meta -->
      <div class="flex items-center gap-2 mb-3">
        <img
          v-if="feed?.favicon"
          :src="feed.favicon"
          class="w-5 h-5 rounded"
          :alt="feed.name"
        />
        <NuxtLink
          v-if="article.feed"
          :to="`/feed/${article.feed}`"
          class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          {{ feed?.name ?? "Unknown feed" }}
        </NuxtLink>
        <span class="text-gray-300 dark:text-gray-600">·</span>
        <span class="text-sm text-gray-400">{{ formattedDate }}</span>
        <span v-if="article.author" class="text-gray-300 dark:text-gray-600">·</span>
        <span v-if="article.author" class="text-sm text-gray-400">{{ article.author }}</span>
      </div>

      <!-- Title -->
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-4">
        {{ article.title }}
      </h1>

      <!-- Action bar -->
      <div class="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800 flex-wrap">
        <UButton
          size="sm"
          :icon="article.read_at ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
          :color="article.read_at ? 'neutral' : 'primary'"
          :variant="article.read_at ? 'outline' : 'solid'"
          :label="article.read_at ? 'Mark unread' : 'Mark as read'"
          @click="handleToggleRead"
        />
        <UButton
          size="sm"
          :icon="article.bookmarked_at ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'"
          :color="article.bookmarked_at ? 'primary' : 'neutral'"
          :variant="article.bookmarked_at ? 'solid' : 'outline'"
          :label="article.bookmarked_at ? 'Bookmarked' : 'Bookmark'"
          @click="handleToggleBookmark"
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
        <UButton
          size="sm"
          icon="i-heroicons-clipboard-document"
          variant="ghost"
          color="neutral"
          label="Copy link"
          @click="copyLink"
        />
      </div>

      <!-- Hero image — hidden if fetched content already contains the same image -->
      <div v-if="article.image_url && !contentContainsHeroImage" class="mb-6 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          :src="article.image_url"
          :alt="article.title"
          class="w-full object-cover max-h-96"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
      </div>

      <!-- Content loading indicator -->
      <div v-if="contentLoading" class="space-y-3 animate-pulse mt-2">
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
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

      <!-- Nothing available -->
      <div v-else class="flex flex-col items-center py-12 text-center text-gray-400">
        <UIcon name="i-heroicons-document-text" class="text-4xl mb-3" />
        <p class="text-sm">No preview available — open the original article to read the full content.</p>
        <UButton
          class="mt-4"
          size="sm"
          icon="i-heroicons-arrow-top-right-on-square"
          label="Open original"
          :to="article.url"
          target="_blank"
          rel="noopener noreferrer"
        />
      </div>

      <!-- Source badge shown when content was fetched -->
      <p v-if="contentSource && !contentLoading" class="mt-8 text-xs text-gray-400 text-center">
        <span v-if="contentSource === 'direct'">Full article fetched from original source</span>
        <span v-else-if="contentSource === 'archive'">Content loaded via archive.ph</span>
        <span v-else-if="contentSource === 'rss'">Preview from RSS feed</span>
      </p>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const pb = usePocketBase();
const { toggleRead, toggleBookmark } = useArticles();

const article = ref<Article | null>(null);
const loading = ref(true);
const error = ref(false);

const contentLoading = ref(false);
const fetchedContent = ref<string | null>(null);
const contentSource = ref<"direct" | "archive" | "rss" | null>(null);

const feed = computed(() => article.value?.expand?.feed);

const formattedDate = computed(() => {
  if (!article.value?.published_at) return "";
  return new Date(article.value.published_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

const contentContainsHeroImage = computed(() =>
  !!fetchedContent.value && !!article.value?.image_url && fetchedContent.value.includes(article.value.image_url)
);

const sanitizedSummary = computed(() => {
  if (!article.value?.summary) return "";
  return article.value.summary
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
});

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const result = await pb.collection("articles").getOne<Article>(route.params.id as string, {
      expand: "feed",
    });

    const { user } = useAuth();
    if (user.value) {
      const uas = await pb.collection("user_articles").getFullList({
        filter: `user = "${user.value.id}" && article = "${result.id}"`,
      }).catch(() => []);
      const ua = uas[0] as any;
      if (ua) {
        result.read_at = ua.read_at;
        result.bookmarked_at = ua.bookmarked_at;
        result.userArticleId = ua.id;
      }
    }

    article.value = result;

    if (!result.read_at && user.value) {
      const ua = await pb.collection("user_articles").create({
        user: user.value.id,
        article: result.id,
        read_at: new Date().toISOString(),
        bookmarked_at: "",
      }).catch(() => null) as any;
      if (ua) {
        article.value.read_at = ua.read_at;
        article.value.userArticleId = ua.id;
      }
    }
  } catch {
    error.value = true;
    return;
  } finally {
    loading.value = false;
  }

  // Fetch full article content in background (non-blocking)
  if (article.value?.url) {
    loadContent(article.value.url);
  }
}

async function loadContent(url: string) {
  contentLoading.value = true;
  try {
    const data = await $fetch<{ content: string | null; source: string }>("/api/fetch-article", {
      query: { url },
    });
    if (data.content) {
      fetchedContent.value = data.content;
      contentSource.value = data.source as "direct" | "archive";
    } else {
      // Fall back to RSS summary — mark the source so the badge shows
      contentSource.value = article.value?.summary ? "rss" : null;
    }
  } catch {
    contentSource.value = article.value?.summary ? "rss" : null;
  } finally {
    contentLoading.value = false;
  }
}

async function handleToggleRead() {
  if (!article.value) return;
  await toggleRead(article.value.id, article.value.userArticleId, article.value.read_at);
  article.value.read_at = article.value.read_at ? "" : new Date().toISOString();
}

async function handleToggleBookmark() {
  if (!article.value) return;
  await toggleBookmark(article.value.id, article.value.userArticleId, article.value.bookmarked_at);
  article.value.bookmarked_at = article.value.bookmarked_at ? "" : new Date().toISOString();
}

async function copyLink() {
  if (!article.value) return;
  await navigator.clipboard.writeText(article.value.url).catch(() => {});
  useToast().add({ title: "Link copied", timeout: 2000 });
}

onMounted(load);
</script>
