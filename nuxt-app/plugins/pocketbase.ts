import PocketBase from "pocketbase";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const url = import.meta.server ? config.pocketbaseUrl : config.public.pocketbaseUrl;

  const pb = new PocketBase(url);

  // Use useState so auth user is serialized in the Nuxt payload and immediately
  // available on the client during hydration — no re-parsing of document.cookie needed.
  const authUser = useState<any>("pb-auth-user", () => null);

  if (import.meta.server) {
    const { cookie } = useRequestHeaders(["cookie"]);
    pb.authStore.loadFromCookie(cookie ?? "");
    authUser.value = pb.authStore.model;
  }

  if (import.meta.client) {
    pb.authStore.loadFromCookie(document.cookie);
    // Sync in case client cookie differs from server payload (e.g. token refreshed)
    authUser.value = pb.authStore.model;
    pb.authStore.onChange(() => {
      document.cookie = pb.authStore.exportToCookie({ httpOnly: false });
      authUser.value = pb.authStore.model;
    });
  }

  nuxtApp.provide("pb", pb);
});
