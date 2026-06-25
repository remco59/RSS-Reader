<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Manage Feeds</h1>
        <p class="text-sm text-gray-500 mt-0.5">Subscribe to feeds and manage your sources</p>
      </div>
      <UButton icon="i-heroicons-plus" label="Add feed" @click="showAdd = true" />
    </div>

    <AddFeedModal v-model:open="showAdd" @added="loadMyFeeds" />
    <EditFeedModal v-model:open="showEdit" :user-feed="editingFeed" @saved="loadMyFeeds" />

    <!-- My subscriptions -->
    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-3">My subscriptions</h2>

      <div v-if="loading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>

      <div v-else-if="myFeeds.length" class="space-y-2">
        <div
          v-for="uf in myFeeds"
          :key="uf.id"
          class="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <img
            v-if="uf.expand?.feed?.favicon"
            :src="uf.expand.feed.favicon"
            class="w-8 h-8 rounded"
          />
          <UIcon v-else :name="feedIcon(uf.expand?.feed?.type)" class="text-2xl text-gray-400" />

          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ uf.alias || uf.expand?.feed?.name }}</p>
            <p class="text-xs text-gray-400 truncate">{{ uf.expand?.feed?.url }}</p>
          </div>

          <UBadge :label="uf.expand?.feed?.type ?? 'rss'" variant="soft" size="sm" />

          <UButton
            icon="i-heroicons-pencil-square"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="openEdit(uf)"
          />

          <UButton
            icon="i-heroicons-trash"
            variant="ghost"
            color="error"
            size="sm"
            @click="removeSubscription(uf.id)"
          />
        </div>
      </div>

      <UAlert
        v-else
        icon="i-heroicons-information-circle"
        color="info"
        title="No subscriptions yet"
        description="Add your first feed with the button above."
      />
    </section>

    <!-- All available feeds -->
    <section>
      <h2 class="text-lg font-semibold mb-3">All feeds</h2>
      <div class="space-y-2">
        <div
          v-for="feed in allFeeds"
          :key="feed.id"
          class="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <img v-if="feed.favicon" :src="feed.favicon" class="w-8 h-8 rounded" />
          <UIcon v-else :name="feedIcon(feed.type)" class="text-2xl text-gray-400" />

          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ feed.name }}</p>
            <p class="text-xs text-gray-400 truncate">{{ feed.url }}</p>
          </div>

          <UBadge :label="feed.type" variant="soft" size="sm" />

          <UButton
            v-if="!subscribedFeedIds.has(feed.id)"
            icon="i-heroicons-plus"
            variant="outline"
            size="sm"
            label="Subscribe"
            @click="addSubscription(feed.id)"
          />
          <UBadge v-else label="Subscribed" color="success" variant="soft" size="sm" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Feed, UserFeed } from "~/composables/useFeeds";

definePageMeta({ middleware: "auth" });

const { getMyFeeds, getAllFeeds, subscribe, unsubscribe } = useFeeds();

const myFeeds = ref<UserFeed[]>([]);
const allFeeds = ref<Feed[]>([]);
const loading = ref(true);
const showAdd = ref(false);
const showEdit = ref(false);
const editingFeed = ref<UserFeed | null>(null);

const subscribedFeedIds = computed(
  () => new Set(myFeeds.value.map((uf) => uf.feed))
);

function feedIcon(type?: string) {
  if (type === "instagram") return "i-simple-icons-instagram";
  if (type === "facebook") return "i-simple-icons-facebook";
  if (type === "youtube") return "i-simple-icons-youtube";
  return "i-heroicons-rss";
}

async function loadMyFeeds() {
  myFeeds.value = await getMyFeeds();
}

async function removeSubscription(userFeedId: string) {
  await unsubscribe(userFeedId);
  await loadMyFeeds();
}

async function addSubscription(feedId: string) {
  await subscribe(feedId);
  await loadMyFeeds();
}

function openEdit(uf: UserFeed) {
  editingFeed.value = uf;
  showEdit.value = true;
}

onMounted(async () => {
  loading.value = true;
  try {
    [myFeeds.value, allFeeds.value] = await Promise.all([getMyFeeds(), getAllFeeds()]);
  } finally {
    loading.value = false;
  }
});
</script>
