<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
    <!-- Mobile backdrop -->
    <Transition name="fade">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 bg-black/50 md:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto transition-transform duration-200 md:relative md:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Logo -->
      <div class="px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
        <UIcon name="i-heroicons-rss" class="text-primary-500 text-xl" />
        <span class="font-bold text-lg flex-1">FeedFlow</span>
        <button
          class="md:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          @click="sidebarOpen = false"
        >
          <UIcon name="i-heroicons-x-mark" class="text-xl" />
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-2 py-3 space-y-0.5">
        <NuxtLink
          v-for="link in mainLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
          :class="$route.path === link.to
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'"
        >
          <UIcon :name="link.icon" class="text-base flex-shrink-0" />
          {{ link.label }}
        </NuxtLink>

        <!-- My Feeds grouped by category -->
        <div class="pt-4">
          <div class="flex items-center justify-between px-3 mb-1">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">My Feeds</p>
            <NuxtLink
              to="/settings/categories"
              title="Manage categories"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <UIcon name="i-heroicons-tag" class="text-sm" />
            </NuxtLink>
          </div>

          <template v-if="userFeeds.length">
            <template v-for="group in feedsByCategory" :key="group.category?.id ?? '__none__'">
              <!-- Category header -->
              <NuxtLink
                v-if="group.category"
                :to="`/category/${group.category.id}`"
                class="flex items-center gap-1.5 px-3 py-1 mt-2 group"
              >
                <div
                  v-if="group.category.color"
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :style="`background:${group.category.color}`"
                />
                <UIcon v-else name="i-heroicons-folder" class="text-gray-400 text-xs flex-shrink-0" />
                <span
                  class="text-xs font-semibold uppercase tracking-wider truncate transition-colors"
                  :class="$route.params.id === group.category.id
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'"
                >
                  {{ group.category.name }}
                </span>
              </NuxtLink>

              <!-- Feeds in this group -->
              <NuxtLink
                v-for="uf in group.feeds"
                :key="uf.id"
                :to="`/feed/${uf.feed}`"
                class="flex items-center gap-2 py-1.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                :class="[
                  group.category ? 'px-3 pl-6' : 'px-3',
                  $route.params.id === uf.feed
                    ? 'bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400',
                ]"
              >
                <img
                  v-if="uf.expand?.feed?.favicon"
                  :src="uf.expand.feed.favicon"
                  class="w-4 h-4 rounded flex-shrink-0"
                />
                <UIcon v-else :name="feedIcon(uf.expand?.feed?.type)" class="text-gray-400 text-sm flex-shrink-0" />
                <span class="truncate">{{ uf.alias || uf.expand?.feed?.name }}</span>
              </NuxtLink>
            </template>
          </template>
          <p v-else class="px-3 text-xs text-gray-400 py-1">No feeds yet</p>
        </div>
      </nav>

      <!-- User -->
      <div class="px-3 py-3 border-t border-gray-200 dark:border-gray-800">
        <UDropdownMenu :items="userMenuItems">
          <div class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md px-2 py-1.5 transition-colors w-full">
            <UAvatar :alt="user?.name ?? user?.email" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate">{{ user?.name ?? user?.email }}</p>
            </div>
            <UIcon name="i-heroicons-chevron-up-down" class="text-gray-400 text-sm flex-shrink-0" />
          </div>
        </UDropdownMenu>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto">
      <!-- Mobile top bar -->
      <div class="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 md:hidden">
        <button
          class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          @click="sidebarOpen = true"
        >
          <UIcon name="i-heroicons-bars-3" class="text-xl" />
        </button>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-rss" class="text-primary-500 text-lg" />
          <span class="font-bold">FeedFlow</span>
        </div>
      </div>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Category, UserFeed } from "~/composables/useFeeds";

const { user, logout } = useAuth();
const { getMyFeeds, getCategories } = useFeeds();
const colorMode = useColorMode();
const route = useRoute();

const sidebarOpen = ref(false);

watch(() => route.path, () => {
  sidebarOpen.value = false;
});

const userFeeds = ref<UserFeed[]>([]);
const categories = ref<Category[]>([]);

const feedsByCategory = computed(() => {
  const map = new Map<string, { category: Category | null; feeds: UserFeed[] }>();

  for (const uf of userFeeds.value) {
    const catId = uf.expand?.feed?.category ?? "";
    if (!map.has(catId)) {
      map.set(catId, {
        category: categories.value.find((c) => c.id === catId) ?? null,
        feeds: [],
      });
    }
    map.get(catId)!.feeds.push(uf);
  }

  return [...map.values()].sort((a, b) => {
    if (!a.category && b.category) return 1;
    if (a.category && !b.category) return -1;
    return (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
  });
});

onMounted(async () => {
  [userFeeds.value, categories.value] = await Promise.all([getMyFeeds(), getCategories()]);
});

function feedIcon(type?: string) {
  if (type === "instagram") return "i-heroicons-camera";
  if (type === "facebook") return "i-heroicons-users";
  if (type === "youtube") return "i-heroicons-play-circle";
  if (type === "scrape") return "i-heroicons-globe-alt";
  return "i-heroicons-rss";
}

const mainLinks = [
  { label: "For You", icon: "i-heroicons-home", to: "/" },
  { label: "Bookmarks", icon: "i-heroicons-bookmark", to: "/bookmarks" },
  { label: "Search", icon: "i-heroicons-magnifying-glass", to: "/search" },
  { label: "Manage Feeds", icon: "i-heroicons-cog-6-tooth", to: "/settings/feeds" },
];

const userMenuItems = [
  [
    {
      label: colorMode.value === "dark" ? "Light mode" : "Dark mode",
      icon: "i-heroicons-moon",
      onSelect: () => {
        colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
      },
    },
  ],
  [
    {
      label: "Sign out",
      icon: "i-heroicons-arrow-left-on-rectangle",
      onSelect: logout,
    },
  ],
];
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
