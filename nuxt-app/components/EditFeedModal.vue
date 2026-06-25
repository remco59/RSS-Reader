<template>
  <UModal v-model:open="open">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold text-lg">Edit feed settings</h3>
        </template>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-circle"
          :description="error"
          class="mb-4"
        />

        <UForm :state="form" :schema="schema" class="space-y-4" @submit="submit">
          <UFormField label="Your alias" name="alias" description="Personal name shown only to you; leave blank to use the feed's name.">
            <UInput v-model="form.alias" :placeholder="userFeed?.expand?.feed?.name ?? 'My alias'" class="w-full" />
          </UFormField>

          <USeparator label="Feed settings" />

          <UFormField label="Name" name="name">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>

          <UFormField label="Category" name="category">
            <USelect v-model="form.category" :items="categoryOptions" placeholder="None" class="w-full" />
          </UFormField>

          <UFormField label="Description" name="description">
            <UInput v-model="form.description" class="w-full" />
          </UFormField>

          <UFormField label="Fetch interval (minutes)" name="fetch_interval_mins">
            <UInput v-model="form.fetch_interval_mins" type="number" min="5" max="1440" class="w-full" />
          </UFormField>

          <UFormField label="Favicon URL" name="favicon">
            <UInput v-model="form.favicon" placeholder="https://example.com/favicon.ico" class="w-full" />
          </UFormField>

          <UFormField label="Active" name="is_active">
            <USwitch v-model="form.is_active" />
          </UFormField>

          <div class="text-xs text-gray-400 space-y-0.5 pt-1">
            <p><span class="font-medium">Type:</span> {{ userFeed?.expand?.feed?.type }}</p>
            <p><span class="font-medium">URL:</span> {{ userFeed?.expand?.feed?.url }}</p>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
            <UButton type="submit" label="Save" :loading="saving" />
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from "zod";
import type { Category, UserFeed } from "~/composables/useFeeds";

const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{ userFeed: UserFeed | null }>();
const emit = defineEmits<{ saved: [] }>();

const { getCategories, updateFeed, updateUserFeed } = useFeeds();
const saving = ref(false);
const error = ref<string | null>(null);
const categories = ref<Category[]>([]);

const form = reactive({
  alias: "",
  name: "",
  category: "",
  description: "",
  favicon: "",
  fetch_interval_mins: 60,
  is_active: true,
});

const schema = z.object({
  alias: z.string().max(200).optional(),
  name: z.string().min(1, "Name is required"),
  fetch_interval_mins: z.coerce.number().int().min(5).max(1440),
});

const categoryOptions = computed(() => [
  { label: "None", value: "" },
  ...categories.value.map((c) => ({ label: c.name, value: c.id })),
]);

watch(
  () => props.userFeed,
  (uf) => {
    if (!uf) return;
    const feed = uf.expand?.feed;
    form.alias = uf.alias ?? "";
    form.name = feed?.name ?? "";
    form.category = feed?.category ?? "";
    form.description = feed?.description ?? "";
    form.favicon = feed?.favicon ?? "";
    form.fetch_interval_mins = feed?.fetch_interval_mins ?? 60;
    form.is_active = feed?.is_active ?? true;
  },
  { immediate: true },
);

onMounted(async () => {
  categories.value = await getCategories();
});

async function submit() {
  if (!props.userFeed?.expand?.feed) return;
  saving.value = true;
  error.value = null;
  try {
    await Promise.all([
      updateUserFeed(props.userFeed.id, { alias: form.alias }),
      updateFeed(props.userFeed.expand.feed.id, {
        name: form.name,
        category: form.category || undefined,
        description: form.description,
        favicon: form.favicon || undefined,
        fetch_interval_mins: Number(form.fetch_interval_mins),
        is_active: form.is_active,
      }),
    ]);
    open.value = false;
    emit("saved");
  } catch (err: any) {
    error.value = err?.message || "Failed to save. Please try again.";
  } finally {
    saving.value = false;
  }
}

watch(open, (val) => {
  if (!val) error.value = null;
});
</script>
