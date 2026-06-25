<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <img v-if="feed?.favicon" :src="feed.favicon" class="w-8 h-8 rounded" :alt="feed?.name" />
      <div class="flex-1">
        <h1 class="text-2xl font-bold">{{ feed?.name ?? "Feed" }}</h1>
        <p v-if="feed?.description" class="text-sm text-gray-500 mt-0.5">{{ feed.description }}</p>
      </div>
      <UButton
        v-if="isSubscribed"
        icon="i-heroicons-minus"
        color="neutral"
        variant="outline"
        label="Unsubscribe"
        :loading="toggling"
        @click="toggleSubscription"
      />
      <UButton
        v-else
        icon="i-heroicons-plus"
        label="Subscribe"
        :loading="toggling"
        @click="toggleSubscription"
      />
    </div>

    <ArticleList
      :articles="articles"
      :loading="loading"
      :total-items="totalItems"
      :total-pages="totalPages"
      :per-page="30"
      :page="page"
      :empty-message="`No articles found for ${feed?.name ?? 'this feed'}.`"
      @page-change="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { Article } from "~/composables/useArticles";
import type { Feed, UserFeed } from "~/composables/useFeeds";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const feedId = computed(() => route.params.id as string);

const pb = usePocketBase();
const { fetchArticles } = useArticles();
const { getMyFeeds, subscribe, unsubscribe } = useFeeds();

const feed = ref<Feed | null>(null);
const articles = ref<Article[]>([]);
const loading = ref(true);
const totalItems = ref(0);
const totalPages = ref(1);
const page = ref(1);
const userFeed = ref<UserFeed | null>(null);
const toggling = ref(false);

const isSubscribed = computed(() => !!userFeed.value);

async function loadFeed() {
  feed.value = await pb.collection("feeds").getOne<Feed>(feedId.value, { expand: "category" });
}

async function loadArticles() {
  loading.value = true;
  try {
    const result = await fetchArticles({ feedId: feedId.value, page: page.value });
    articles.value = result.items;
    totalItems.value = result.totalItems;
    totalPages.value = result.totalPages;
  } finally {
    loading.value = false;
  }
}

async function loadSubscription() {
  const feeds = await getMyFeeds();
  userFeed.value = feeds.find((uf) => uf.feed === feedId.value) ?? null;
}

async function toggleSubscription() {
  toggling.value = true;
  try {
    if (userFeed.value) {
      await unsubscribe(userFeed.value.id);
      userFeed.value = null;
    } else {
      await subscribe(feedId.value);
      await loadSubscription();
    }
  } finally {
    toggling.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  loadArticles();
}

onMounted(async () => {
  await Promise.all([loadFeed(), loadSubscription()]);
  await loadArticles();
});
</script>
