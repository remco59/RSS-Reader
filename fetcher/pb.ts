import PocketBase from "pocketbase";

const url = process.env.POCKETBASE_URL ?? "http://localhost:8090";
export const pb = new PocketBase(url);

export async function authenticate() {
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set");
  }
  // Authenticate as superuser so the fetcher can write to all collections
  await pb.collection("_superusers").authWithPassword(email, password);
  console.log("[pb] authenticated as superuser");
}
