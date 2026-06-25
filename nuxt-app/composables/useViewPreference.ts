export type ViewMode = "grid" | "list" | "split";

export const useViewPreference = () => {
  const view = useState<ViewMode>("viewMode", () => "grid");

  // Restore saved preference after hydration to avoid SSR/client mismatch
  onMounted(() => {
    const stored = localStorage.getItem("feedflow-view") as ViewMode | null;
    if (stored && stored !== view.value) view.value = stored;
  });

  function setView(v: ViewMode) {
    view.value = v;
    localStorage.setItem("feedflow-view", v);
  }

  return { view, setView };
};
