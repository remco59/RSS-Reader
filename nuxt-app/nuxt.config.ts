export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@vueuse/nuxt"],

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    pocketbaseUrl: process.env.POCKETBASE_URL ?? "http://localhost:8090",
    public: {
      pocketbaseUrl: process.env.PUBLIC_POCKETBASE_URL ?? "http://localhost:8090",
    },
  },

  ui: {
    colorMode: true,
  },

  app: {
    head: {
      title: "FeedFlow",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "Your personal feed aggregator" },
      ],
    },
  },

  devtools: { enabled: true },
  compatibilityDate: "2024-11-01",
});
