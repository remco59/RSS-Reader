<template>
  <UModal v-model:open="open">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold text-lg">Add a new feed</h3>
        </template>

        <div class="overflow-y-auto max-h-[70vh]">
          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-circle"
            :description="error"
            class="mb-3"
          />

        <UTabs v-model="activeTab" :items="tabs" class="-mx-1">
          <template #search>
            <div class="pt-4 space-y-4">
              <UInput
                v-model="searchQuery"
                icon="i-heroicons-magnifying-glass"
                placeholder="Search for a publication, topic, or URL…"
                class="w-full"
                autofocus
                @keyup.enter="doSearch"
              >
                <template #trailing>
                  <UButton
                    v-if="searchQuery"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-heroicons-x-mark"
                    @click="searchQuery = ''; searchResults = []"
                  />
                </template>
              </UInput>

              <div v-if="searching" class="space-y-2">
                <div
                  v-for="i in 3"
                  :key="i"
                  class="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
                />
              </div>

              <div v-else-if="searchResults.length" class="space-y-2 max-h-96 overflow-y-auto">
                <div
                  v-for="result in searchResults"
                  :key="result.url"
                  class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <img
                    v-if="result.favicon"
                    :src="result.favicon"
                    class="w-8 h-8 rounded flex-shrink-0 mt-0.5"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <UIcon v-else name="i-heroicons-rss" class="text-2xl text-gray-400 flex-shrink-0 mt-0.5" />

                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm truncate">{{ result.title || result.site_name || result.url }}</p>
                    <p v-if="result.description" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {{ result.description }}
                    </p>
                    <p class="text-xs text-gray-400 truncate mt-0.5">{{ result.url }}</p>
                  </div>

                  <UButton
                    size="sm"
                    :variant="subscribed.has(result.url) ? 'soft' : 'outline'"
                    :color="subscribed.has(result.url) ? 'success' : undefined"
                    :icon="subscribed.has(result.url) ? 'i-heroicons-check' : undefined"
                    :label="subscribed.has(result.url) ? 'Added' : 'Subscribe'"
                    :loading="adding === result.url"
                    :disabled="subscribed.has(result.url)"
                    class="flex-shrink-0"
                    @click="subscribeToResult(result)"
                  />
                </div>
              </div>

              <p v-else-if="hasSearched && !searching" class="text-sm text-gray-500 text-center py-4">
                No feeds found. Try a different keyword or paste a URL directly.
              </p>
            </div>
          </template>

          <template #manual>
            <div class="pt-4">
              <UForm :state="form" :schema="schema" class="space-y-4" @submit="submit">
                <UFormField label="Name" name="name">
                  <UInput v-model="form.name" placeholder="The Verge" class="w-full" />
                </UFormField>

                <UFormField label="URL" name="url">
                  <div class="flex gap-2">
                    <UInput v-model="form.url" placeholder="https://example.com/events" class="w-full" />
                    <UButton
                      v-if="form.type === 'scrape'"
                      variant="outline"
                      icon="i-heroicons-eye"
                      label="Preview"
                      :loading="previewing"
                      :disabled="!form.url"
                      @click="runPreview"
                    />
                  </div>
                </UFormField>

                <UFormField label="Type" name="type">
                  <USelect v-model="form.type" :items="typeOptions" class="w-full" @change="onTypeChange" />
                </UFormField>

                <!-- Scrape preview panel -->
                <div v-if="form.type === 'scrape'" class="space-y-4">
                  <!-- Loading -->
                  <div v-if="previewing" class="space-y-2">
                    <div
                      v-for="i in 3"
                      :key="i"
                      class="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
                    />
                  </div>

                  <!-- Error -->
                  <UAlert
                    v-else-if="previewError"
                    color="warning"
                    variant="soft"
                    icon="i-heroicons-exclamation-triangle"
                    :description="previewError"
                  />

                  <!-- Results -->
                  <div v-else-if="previewItems.length" class="space-y-2">
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Preview — {{ previewItems.length }} items found
                      </p>
                      <UBadge
                        :label="detectedViaLabel"
                        :color="detectedViaColor"
                        variant="subtle"
                        size="xs"
                      />
                    </div>

                    <div class="space-y-2">
                      <div
                        v-for="item in previewItems"
                        :key="item.url"
                        class="flex gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <img
                          v-if="item.image_url"
                          :src="item.image_url"
                          class="w-14 h-14 rounded object-cover flex-shrink-0"
                          @error="($event.target as HTMLImageElement).style.display = 'none'"
                        />
                        <div
                          v-else
                          class="w-14 h-14 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center"
                        >
                          <UIcon name="i-heroicons-globe-alt" class="text-gray-400 text-xl" />
                        </div>

                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium line-clamp-1">{{ item.title }}</p>
                          <p v-if="item.summary" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                            {{ item.summary }}
                          </p>
                          <p v-if="item.published_at" class="text-xs text-gray-400 mt-0.5">
                            {{ formatDate(item.published_at) }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Advanced: CSS selectors -->
                  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      class="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      @click="showSelectors = !showSelectors"
                    >
                      <span class="flex items-center gap-2">
                        <UIcon name="i-heroicons-adjustments-horizontal" class="text-base" />
                        {{ previewItems.length ? 'Preview not right? Use custom selectors' : 'Advanced: custom CSS selectors' }}
                      </span>
                      <UIcon
                        :name="showSelectors ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                        class="text-base"
                      />
                    </button>

                    <div v-if="showSelectors" class="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200 dark:border-gray-700">
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        Specify CSS selectors to control exactly what gets extracted. Use browser DevTools to find the right selectors.
                      </p>

                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="List item" name="item_selector">
                          <UInput
                            v-model="scrapeConfig.item_selector"
                            placeholder="article, .event-card"
                            class="w-full font-mono text-xs"
                          />
                        </UFormField>

                        <UFormField label="Link (within item)" name="link_selector">
                          <UInput
                            v-model="scrapeConfig.link_selector"
                            placeholder="a (default)"
                            class="w-full font-mono text-xs"
                          />
                        </UFormField>

                        <UFormField label="Title" name="title_selector">
                          <UInput
                            v-model="scrapeConfig.title_selector"
                            placeholder="h2, h3"
                            class="w-full font-mono text-xs"
                          />
                        </UFormField>

                        <UFormField label="Image" name="image_selector">
                          <UInput
                            v-model="scrapeConfig.image_selector"
                            placeholder="img"
                            class="w-full font-mono text-xs"
                          />
                        </UFormField>

                        <UFormField label="Date" name="date_selector">
                          <UInput
                            v-model="scrapeConfig.date_selector"
                            placeholder="time, .date"
                            class="w-full font-mono text-xs"
                          />
                        </UFormField>

                        <UFormField label="URL pattern filter" name="url_pattern">
                          <UInput
                            v-model="scrapeConfig.url_pattern"
                            placeholder="/evenement/"
                            class="w-full font-mono text-xs"
                          />
                        </UFormField>
                      </div>

                      <UButton
                        variant="outline"
                        size="sm"
                        icon="i-heroicons-arrow-path"
                        label="Preview with these selectors"
                        :loading="previewing"
                        :disabled="!form.url"
                        @click="runPreview"
                      />
                    </div>
                  </div>
                </div>

                <UFormField label="Category (optional)" name="category">
                  <USelect
                    v-model="form.category"
                    :items="categoryOptions"
                    placeholder="None"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Description (optional)" name="description">
                  <UInput v-model="form.description" placeholder="Tech news and reviews" class="w-full" />
                </UFormField>

                <UFormField label="Favicon URL (optional)" name="favicon">
                  <UInput v-model="form.favicon" placeholder="https://example.com/favicon.ico" class="w-full" />
                </UFormField>

                <div class="flex justify-end gap-2 pt-2">
                  <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
                  <UButton type="submit" label="Add feed" :loading="saving" />
                </div>
              </UForm>
            </div>
          </template>
        </UTabs>
        </div><!-- end scrollable wrapper -->
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from "zod";
import type { Category } from "~/composables/useFeeds";
import type { FeedSearchResult } from "~/server/api/search-feeds.get";
import type { ScrapedItem } from "~/lib/universalScraper";

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ added: [] }>();

const { addFeed, getCategories } = useFeeds();
const saving = ref(false);
const categories = ref<Category[]>([]);
const error = ref<string | null>(null);

const activeTab = ref("search");
const tabs = [
  { label: "Search online", slot: "search" as const },
  { label: "Add manually", slot: "manual" as const },
];

// --- Search tab ---
const searchQuery = ref("");
const searchResults = ref<FeedSearchResult[]>([]);
const searching = ref(false);
const hasSearched = ref(false);
const adding = ref<string | null>(null);
const subscribed = ref(new Set<string>());

const debouncedSearch = useDebounceFn(doSearch, 500);
watch(searchQuery, () => {
  if (searchQuery.value.length >= 2) debouncedSearch();
});

async function doSearch() {
  if (!searchQuery.value.trim()) return;
  searching.value = true;
  hasSearched.value = true;
  try {
    searchResults.value = await $fetch<FeedSearchResult[]>("/api/search-feeds", {
      query: { q: searchQuery.value },
    });
  } finally {
    searching.value = false;
  }
}

async function subscribeToResult(result: FeedSearchResult) {
  adding.value = result.url;
  error.value = null;
  try {
    await addFeed({
      name: result.title || result.site_name || result.url,
      url: result.url,
      type: "rss",
      description: result.description || undefined,
      favicon: result.favicon || undefined,
    });
    subscribed.value = new Set([...subscribed.value, result.url]);
    emit("added");
  } catch (err: any) {
    error.value = err?.message || "Failed to add feed. Please try again.";
  } finally {
    adding.value = null;
  }
}

// --- Manual tab ---
const form = reactive({
  name: "",
  url: "",
  type: "rss" as "rss" | "instagram" | "facebook" | "youtube" | "scrape",
  category: "",
  description: "",
  favicon: "",
});

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  type: z.enum(["rss", "instagram", "facebook", "youtube", "scrape"]),
});

const typeOptions = [
  { label: "RSS / Atom / Blog", value: "rss" },
  { label: "YouTube channel", value: "youtube" },
  { label: "Instagram page", value: "instagram" },
  { label: "Facebook page", value: "facebook" },
  { label: "Website scraper", value: "scrape" },
];

watch(
  () => form.url,
  (url) => {
    if (form.favicon) return;
    try {
      const { hostname } = new URL(url);
      form.favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      // invalid URL — leave favicon blank
    }
  },
);

// --- Scrape preview ---
const previewing = ref(false);
const previewItems = ref<ScrapedItem[]>([]);
const previewError = ref<string | null>(null);
const showSelectors = ref(false);

const scrapeConfig = reactive({
  item_selector: "",
  link_selector: "",
  title_selector: "",
  image_selector: "",
  date_selector: "",
  url_pattern: "",
});

function onTypeChange() {
  previewItems.value = [];
  previewError.value = null;
  showSelectors.value = false;
}

async function runPreview() {
  if (!form.url) return;
  previewing.value = true;
  previewError.value = null;
  previewItems.value = [];

  const config = buildConfig();
  try {
    const result = await $fetch<{ items: ScrapedItem[]; detected_via: string | null; item_count: number }>(
      "/api/preview-scrape",
      { query: { url: form.url, config: Object.keys(config).length ? JSON.stringify(config) : undefined } }
    );
    previewItems.value = result.items;
    if (result.items.length === 0) {
      previewError.value = "No items found. Try adding custom CSS selectors below.";
      showSelectors.value = true;
    }
  } catch (err: any) {
    previewError.value = err?.data?.message ?? err?.message ?? "Failed to preview this URL.";
    showSelectors.value = true;
  } finally {
    previewing.value = false;
  }
}

function buildConfig(): Record<string, string> {
  const cfg: Record<string, string> = {};
  if (scrapeConfig.item_selector) cfg.item_selector = scrapeConfig.item_selector;
  if (scrapeConfig.link_selector) cfg.link_selector = scrapeConfig.link_selector;
  if (scrapeConfig.title_selector) cfg.title_selector = scrapeConfig.title_selector;
  if (scrapeConfig.image_selector) cfg.image_selector = scrapeConfig.image_selector;
  if (scrapeConfig.date_selector) cfg.date_selector = scrapeConfig.date_selector;
  if (scrapeConfig.url_pattern) cfg.url_pattern = scrapeConfig.url_pattern;
  return cfg;
}

const detectedViaLabel = computed(() => {
  const via = previewItems.value[0]?.detected_via;
  if (via === "json-ld") return "JSON-LD";
  if (via === "open-graph") return "Open Graph";
  if (via === "html-fallback") return "HTML patroon";
  return "Automatisch";
});

const detectedViaColor = computed(() => {
  const via = previewItems.value[0]?.detected_via;
  if (via === "json-ld") return "success" as const;
  if (via === "open-graph") return "info" as const;
  return "warning" as const;
});

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

// --- Categories ---
const categoryOptions = computed(() => [
  { label: "None", value: "" },
  ...categories.value.map((c) => ({ label: c.name, value: c.id })),
]);

onMounted(async () => {
  categories.value = await getCategories();
});

async function submit() {
  saving.value = true;
  error.value = null;
  try {
    const config = buildConfig();
    await addFeed({
      name: form.name,
      url: form.url,
      type: form.type,
      category: form.category || undefined,
      description: form.description || undefined,
      favicon: form.favicon || undefined,
      scrape_config: form.type === "scrape" && Object.keys(config).length ? config : undefined,
    });
    open.value = false;
    emit("added");
    Object.assign(form, { name: "", url: "", type: "rss", category: "", description: "", favicon: "" });
  } catch (err: any) {
    error.value = err?.message || "Failed to add feed. Please try again.";
  } finally {
    saving.value = false;
  }
}

watch(open, (val) => {
  if (!val) {
    searchQuery.value = "";
    searchResults.value = [];
    hasSearched.value = false;
    subscribed.value = new Set();
    activeTab.value = "search";
    error.value = null;
    previewItems.value = [];
    previewError.value = null;
    showSelectors.value = false;
    Object.assign(scrapeConfig, {
      item_selector: "", link_selector: "", title_selector: "",
      image_selector: "", date_selector: "", url_pattern: "",
    });
    Object.assign(form, { name: "", url: "", type: "rss", category: "", description: "", favicon: "" });
  }
});
</script>
