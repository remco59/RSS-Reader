<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-2 mb-2">
          <UIcon name="i-heroicons-rss" class="text-primary-500 text-3xl" />
          <span class="font-bold text-2xl">FeedFlow</span>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Your personal feed aggregator</p>
      </div>
      <slot />
    </div>
  </div>
</template>
