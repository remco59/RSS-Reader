<template>
  <NuxtLayout name="auth">
    <UCard>
      <template #header>
        <h2 class="font-semibold text-lg text-center">Sign in</h2>
      </template>

      <UForm :state="form" :schema="schema" class="space-y-4" @submit="submit">
        <UFormField label="Email" name="email">
          <UInput v-model="form.email" type="email" placeholder="you@example.com" class="w-full" />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput v-model="form.password" type="password" placeholder="••••••••" class="w-full" />
        </UFormField>

        <UAlert v-if="error" color="error" :description="error" />

        <UButton type="submit" class="w-full justify-center" :loading="loading" label="Sign in" />
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-gray-500">
          No account?
          <NuxtLink to="/auth/register" class="text-primary-500 hover:underline">Create one</NuxtLink>
        </p>
      </template>
    </UCard>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { z } from "zod";

definePageMeta({ layout: false });

const { login, isLoggedIn } = useAuth();
if (isLoggedIn.value) navigateTo("/");

const form = reactive({ email: "", password: "" });
const loading = ref(false);
const error = ref("");

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

async function submit() {
  loading.value = true;
  error.value = "";
  try {
    await login(form.email, form.password);
    navigateTo("/");
  } catch {
    error.value = "Invalid email or password.";
  } finally {
    loading.value = false;
  }
}
</script>
