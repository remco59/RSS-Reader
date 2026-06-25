<template>
  <NuxtLayout name="auth">
    <UCard>
      <template #header>
        <h2 class="font-semibold text-lg text-center">Create account</h2>
      </template>

      <UForm :state="form" :schema="schema" class="space-y-4" @submit="submit">
        <UFormField label="Name" name="name">
          <UInput v-model="form.name" placeholder="Your name" class="w-full" />
        </UFormField>

        <UFormField label="Email" name="email">
          <UInput v-model="form.email" type="email" placeholder="you@example.com" class="w-full" />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput v-model="form.password" type="password" placeholder="Min. 8 characters" class="w-full" />
        </UFormField>

        <UAlert v-if="error" color="error" :description="error" />

        <UButton type="submit" class="w-full justify-center" :loading="loading" label="Create account" />
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-gray-500">
          Already have an account?
          <NuxtLink to="/auth/login" class="text-primary-500 hover:underline">Sign in</NuxtLink>
        </p>
      </template>
    </UCard>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { z } from "zod";

definePageMeta({ layout: false });

const { register, isLoggedIn } = useAuth();
if (isLoggedIn.value) navigateTo("/");

const form = reactive({ name: "", email: "", password: "" });
const loading = ref(false);
const error = ref("");

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Minimum 8 characters"),
});

async function submit() {
  loading.value = true;
  error.value = "";
  try {
    await register(form.email, form.password, form.name);
    navigateTo("/");
  } catch (e: unknown) {
    error.value = (e as Error)?.message ?? "Registration failed.";
  } finally {
    loading.value = false;
  }
}
</script>
