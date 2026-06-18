import { useCallback, useEffect, useState } from "react";
import {
  deserializeViews,
  serializeViews,
  type SavedView,
} from "@/lib/event-filters";

const STORAGE_KEY = "zawya.admin.eventFilters.v1";

export function useSavedEventFilters() {
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    try {
      setViews(deserializeViews(localStorage.getItem(STORAGE_KEY)));
    } catch {
      setViews([]);
    }
  }, []);

  const persist = useCallback((next: SavedView[]) => {
    setViews(next);
    try {
      localStorage.setItem(STORAGE_KEY, serializeViews(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const saveView = useCallback(
    (view: Omit<SavedView, "id">) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...views, { ...view, id }];
      persist(next);
      return id;
    },
    [views, persist],
  );

  const deleteView = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
    },
    [views, persist],
  );

  return { views, saveView, deleteView };
}
