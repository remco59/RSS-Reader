export function useAuth() {
  const pb = usePocketBase();
  const user = useState<any>("pb-auth-user");
  const isLoggedIn = computed(() => !!user.value && pb.authStore.isValid);

  async function login(email: string, password: string) {
    await pb.collection("users").authWithPassword(email, password);
  }

  async function register(email: string, password: string, name: string) {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      name,
    });
    await login(email, password);
  }

  function logout() {
    pb.authStore.clear();
    navigateTo("/auth/login");
  }

  async function refreshAuth() {
    if (pb.authStore.isValid) {
      try {
        await pb.collection("users").authRefresh();
      } catch {
        pb.authStore.clear();
      }
    }
  }

  return { user, isLoggedIn, login, register, logout, refreshAuth };
}
