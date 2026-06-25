<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Manage Categories</h1>
        <p class="text-sm text-gray-500 mt-0.5">Organize your feeds into categories</p>
      </div>
      <UButton icon="i-heroicons-plus" label="New category" @click="showCreate = true" />
    </div>

    <!-- Create modal -->
    <UModal v-model:open="showCreate">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold text-lg">New category</h3>
          </template>

          <UAlert
            v-if="createError"
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-circle"
            :description="createError"
            class="mb-3"
          />

          <div class="space-y-4">
            <UFormField label="Name" required>
              <UInput
                v-model="newCat.name"
                placeholder="Technology"
                class="w-full"
                autofocus
                @keyup.enter="createCategory"
              />
            </UFormField>

            <UFormField label="Color">
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="color in colorPalette"
                  :key="color"
                  type="button"
                  class="w-7 h-7 rounded-full border-2 transition-all focus:outline-none"
                  :class="newCat.color === color
                    ? 'border-gray-900 dark:border-white scale-110'
                    : 'border-transparent hover:scale-105'"
                  :style="`background:${color}`"
                  :aria-label="color"
                  @click="newCat.color = newCat.color === color ? '' : color"
                />
              </div>
            </UFormField>

            <div class="flex justify-end gap-2 pt-2">
              <UButton variant="ghost" color="neutral" label="Cancel" @click="showCreate = false" />
              <UButton
                label="Create"
                :loading="creating"
                :disabled="!newCat.name.trim()"
                @click="createCategory"
              />
            </div>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
    </div>

    <!-- Category list -->
    <div v-else-if="categories.length" class="space-y-2">
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
      >
        <div
          v-if="cat.color"
          class="w-4 h-4 rounded-full flex-shrink-0"
          :style="`background:${cat.color}`"
        />
        <UIcon v-else name="i-heroicons-tag" class="text-gray-400 text-base flex-shrink-0" />

        <span class="flex-1 font-medium">{{ cat.name }}</span>

        <UBadge v-if="!cat.user" label="System" variant="soft" size="sm" />
        <UButton
          v-else
          icon="i-heroicons-trash"
          variant="ghost"
          color="error"
          size="sm"
          :loading="deleting === cat.id"
          @click="removeCategory(cat.id)"
        />
      </div>
    </div>

    <UAlert
      v-else
      icon="i-heroicons-information-circle"
      color="info"
      title="No categories yet"
      description="Create your first category with the button above, then assign feeds to it from Manage Feeds."
    />
  </div>
</template>

<script setup lang="ts">
import type { Category } from "~/composables/useFeeds";

definePageMeta({ middleware: "auth" });

const { getCategories, addCategory, deleteCategory } = useFeeds();

const categories = ref<Category[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const createError = ref<string | null>(null);
const deleting = ref<string | null>(null);

const newCat = reactive({ name: "", color: "" });

const colorPalette = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280",
];

async function loadCategories() {
  loading.value = true;
  try {
    categories.value = await getCategories();
  } finally {
    loading.value = false;
  }
}

async function createCategory() {
  if (!newCat.name.trim()) return;
  creating.value = true;
  createError.value = null;
  try {
    await addCategory({ name: newCat.name.trim(), color: newCat.color || undefined });
    newCat.name = "";
    newCat.color = "";
    showCreate.value = false;
    await loadCategories();
  } catch (err: any) {
    createError.value = err?.message ?? "Failed to create category.";
  } finally {
    creating.value = false;
  }
}

async function removeCategory(id: string) {
  deleting.value = id;
  try {
    await deleteCategory(id);
    await loadCategories();
  } finally {
    deleting.value = null;
  }
}

watch(showCreate, (val) => {
  if (!val) {
    newCat.name = "";
    newCat.color = "";
    createError.value = null;
  }
});

onMounted(loadCategories);
</script>
