<template>
  <UModal v-model:open="open">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold text-lg">Import / Export Feeds</h3>
        </template>

        <UTabs v-model="activeTab" :items="tabs">
          <template #export>
            <div class="pt-4 space-y-4">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Download your subscriptions as a file you can import into any RSS reader.
              </p>

              <div class="flex gap-3">
                <UButton
                  icon="i-heroicons-arrow-down-tray"
                  label="Export as OPML"
                  :loading="exporting === 'opml'"
                  @click="exportFeeds('opml')"
                />
                <UButton
                  icon="i-heroicons-arrow-down-tray"
                  label="Export as JSON"
                  variant="outline"
                  :loading="exporting === 'json'"
                  @click="exportFeeds('json')"
                />
              </div>

              <p class="text-xs text-gray-400">
                OPML is compatible with Feedly, Inoreader, and most RSS readers.
                JSON preserves all FeedFlow settings including aliases, fetch intervals, and scrape configurations.
              </p>
            </div>
          </template>

          <template #import>
            <div class="pt-4 space-y-4">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Import feed subscriptions from an OPML or FeedFlow JSON file.
              </p>

              <!-- Drop zone -->
              <div
                class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
                :class="
                  dragOver
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                "
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="onDrop"
                @click="fileInputEl?.click()"
              >
                <input
                  ref="fileInputEl"
                  type="file"
                  accept=".opml,.xml,.json"
                  class="hidden"
                  @change="onFileChange"
                />
                <UIcon name="i-heroicons-arrow-up-tray" class="text-3xl text-gray-400 mb-2" />
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drop OPML or JSON file here
                </p>
                <p class="text-xs text-gray-400 mt-1">or click to browse</p>
              </div>

              <!-- Parse error -->
              <UAlert
                v-if="parseError"
                color="error"
                variant="soft"
                icon="i-heroicons-exclamation-circle"
                :description="parseError"
              />

              <!-- Preview -->
              <template v-if="parsedFeeds.length">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">
                    {{ parsedFeeds.length }} feed{{ parsedFeeds.length === 1 ? "" : "s" }} found
                  </p>
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-heroicons-x-mark"
                    @click="resetImport"
                  />
                </div>

                <div
                  class="max-h-48 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-800 rounded-lg p-2"
                >
                  <div
                    v-for="f in parsedFeeds"
                    :key="f.url"
                    class="flex items-center gap-2 text-xs py-0.5"
                  >
                    <UIcon name="i-heroicons-rss" class="text-gray-400 flex-shrink-0" />
                    <span class="truncate font-medium">{{ f.name }}</span>
                    <span v-if="f.category" class="text-gray-400 flex-shrink-0 ml-auto pl-2">
                      {{ f.category }}
                    </span>
                  </div>
                </div>

                <!-- Result after import -->
                <UAlert
                  v-if="importResult"
                  :color="importResult.errors.length ? 'warning' : 'success'"
                  variant="soft"
                  :icon="
                    importResult.errors.length
                      ? 'i-heroicons-exclamation-triangle'
                      : 'i-heroicons-check-circle'
                  "
                  :title="importResult.errors.length ? 'Completed with errors' : 'Import successful'"
                  :description="importSummary"
                />

                <UButton
                  v-if="!importResult"
                  icon="i-heroicons-arrow-up-tray"
                  :label="`Import ${parsedFeeds.length} feed${parsedFeeds.length === 1 ? '' : 's'}`"
                  :loading="importing"
                  @click="doImport"
                />

                <UButton
                  v-else
                  label="Done"
                  variant="outline"
                  @click="open = false; emit('imported')"
                />
              </template>
            </div>
          </template>
        </UTabs>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ imported: [] }>();

const tabs = [
  { label: "Export", slot: "export" },
  { label: "Import", slot: "import" },
];
const activeTab = ref("export");

// ── Export ────────────────────────────────────────────────────────────────────

const exporting = ref<"opml" | "json" | null>(null);

async function exportFeeds(format: "opml" | "json") {
  exporting.value = format;
  try {
    const res = await $fetch<any>(`/api/export?format=${format}`);

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === "opml") {
      content = typeof res === "string" ? res : String(res);
      filename = "feedflow-export.opml";
      mimeType = "text/x-opml+xml";
    } else {
      content = JSON.stringify(res, null, 2);
      filename = "feedflow-export.json";
      mimeType = "application/json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    exporting.value = null;
  }
}

// ── Import ────────────────────────────────────────────────────────────────────

interface ParsedFeed {
  name: string;
  url: string;
  type?: string;
  category?: string | null;
  alias?: string | null;
  fetch_interval_mins?: number;
  description?: string | null;
  favicon?: string | null;
  scrape_config?: string | null;
}

interface ParsedCategory {
  name: string;
  color?: string | null;
  icon?: string | null;
}

const fileInputEl = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const parseError = ref<string | null>(null);
const parsedFeeds = ref<ParsedFeed[]>([]);
const parsedCategories = ref<ParsedCategory[]>([]);
const importing = ref(false);
const importResult = ref<{ imported: number; skipped: number; errors: string[] } | null>(null);

const importSummary = computed(() => {
  if (!importResult.value) return "";
  const { imported, skipped, errors } = importResult.value;
  const parts = [`${imported} added`, `${skipped} already subscribed`];
  if (errors.length) parts.push(`${errors.length} failed`);
  return parts.join(", ");
});

function resetImport() {
  parsedFeeds.value = [];
  parsedCategories.value = [];
  parseError.value = null;
  importResult.value = null;
  if (fileInputEl.value) fileInputEl.value.value = "";
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) readFile(file);
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) readFile(file);
}

function readFile(file: File) {
  parseError.value = null;
  importResult.value = null;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    try {
      if (file.name.endsWith(".opml") || file.name.endsWith(".xml") || text.trimStart().startsWith("<")) {
        const { feeds } = parseOpml(text);
        parsedFeeds.value = feeds;
        parsedCategories.value = [];
      } else {
        const { feeds, categories } = parseJson(text);
        parsedFeeds.value = feeds;
        parsedCategories.value = categories;
      }
      if (parsedFeeds.value.length === 0) {
        parseError.value = "No feeds found in the file.";
      }
    } catch (err: any) {
      parseError.value = err.message ?? "Failed to parse file.";
      parsedFeeds.value = [];
    }
  };
  reader.readAsText(file);
}

function parseOpml(content: string): { feeds: ParsedFeed[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Invalid XML: " + parserError.textContent?.slice(0, 100));

  const feeds: ParsedFeed[] = [];

  function walk(el: Element, category?: string) {
    const xmlUrl = el.getAttribute("xmlUrl");
    if (xmlUrl) {
      feeds.push({
        name: el.getAttribute("text") || el.getAttribute("title") || xmlUrl,
        url: xmlUrl,
        type: "rss",
        category: category ?? null,
      });
    } else {
      // Treat as a category folder
      const folderName = el.getAttribute("text") || el.getAttribute("title") || undefined;
      for (const child of el.children) {
        walk(child, folderName ?? category);
      }
    }
  }

  const body = doc.querySelector("body");
  if (body) {
    for (const child of body.children) walk(child);
  }

  return { feeds };
}

function parseJson(content: string): { feeds: ParsedFeed[]; categories: ParsedCategory[] } {
  const data = JSON.parse(content);

  if (data.app === "feedflow") {
    return {
      feeds: (data.feeds ?? []) as ParsedFeed[],
      categories: (data.categories ?? []) as ParsedCategory[],
    };
  }

  // Generic JSON feed list fallback
  if (Array.isArray(data)) {
    return {
      feeds: data.map((item: any) => ({
        name: item.name ?? item.title ?? item.url,
        url: item.url ?? item.xmlUrl,
        type: item.type ?? "rss",
      })),
      categories: [],
    };
  }

  throw new Error("Unrecognized JSON format. Expected a FeedFlow export or an array of feed objects.");
}

async function doImport() {
  importing.value = true;
  try {
    const result = await $fetch<{ imported: number; skipped: number; errors: string[] }>("/api/import", {
      method: "POST",
      body: {
        feeds: parsedFeeds.value,
        categories: parsedCategories.value,
      },
    });
    importResult.value = result;
  } catch (e: any) {
    parseError.value = e.data?.message ?? e.message ?? "Import failed.";
  } finally {
    importing.value = false;
  }
}
</script>
