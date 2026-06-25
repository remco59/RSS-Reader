import type PocketBase from "pocketbase";

export function usePocketBase(): PocketBase {
  return useNuxtApp().$pb as PocketBase;
}
