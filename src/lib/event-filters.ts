export type FilterKey = "upcoming" | "past" | "published" | "scheduled" | "draft";
export type SortOrder = "newest" | "oldest";

export interface DateRange {
  from?: string | null; // ISO date (yyyy-MM-dd) or full ISO
  to?: string | null;
}

export interface EventLike {
  id: string;
  title: string;
  date_time: string;
  end_date_time?: string | null;
  location?: string | null;
  address?: string | null;
  published?: boolean | null;
  scheduled_publish_at?: string | null;
  status?: string | null;
  event_type_id?: string | null;
  host?: { name?: string | null } | null;
}

export function isEventPast(event: Pick<EventLike, "date_time" | "end_date_time">): boolean {
  const now = Date.now();
  if (event.end_date_time) return new Date(event.end_date_time).getTime() < now;
  return new Date(event.date_time).getTime() + 4 * 60 * 60 * 1000 < now;
}

export function matchesSearch(
  event: EventLike,
  search: string,
  typeNameById: (id?: string | null) => string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    event.title,
    event.location,
    event.address,
    typeNameById(event.event_type_id),
    event.host?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function matchesStatusFilters(event: EventLike, filters: Set<FilterKey>): boolean {
  const statusKeys: FilterKey[] = ["published", "scheduled", "draft"];
  const active = statusKeys.filter((k) => filters.has(k));
  if (active.length === 0) return true;
  return active.some((k) => {
    if (k === "published") return !!event.published;
    if (k === "scheduled") return !event.published && !!event.scheduled_publish_at;
    if (k === "draft") return !event.published && !event.scheduled_publish_at;
    return false;
  });
}

export function inDateRange(event: EventLike, range: DateRange | null | undefined): boolean {
  if (!range || (!range.from && !range.to)) return true;
  const t = new Date(event.date_time).getTime();
  if (range.from) {
    const fromT = new Date(range.from).setHours(0, 0, 0, 0);
    if (t < fromT) return false;
  }
  if (range.to) {
    const toT = new Date(range.to).setHours(23, 59, 59, 999);
    if (t > toT) return false;
  }
  return true;
}

export function sortEvents<T extends Pick<EventLike, "date_time">>(events: T[], order: SortOrder): T[] {
  const dir = order === "newest" ? -1 : 1;
  return [...events].sort((a, b) => dir * a.date_time.localeCompare(b.date_time));
}

// localStorage preset (de)serialization
export interface SavedView {
  id: string;
  name: string;
  filters: FilterKey[];
  search: string;
  sortOrder: SortOrder;
  dateRange: DateRange | null;
}

export function serializeViews(views: SavedView[]): string {
  return JSON.stringify(views);
}

export function deserializeViews(raw: string | null | undefined): SavedView[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is SavedView =>
      !!v && typeof v.id === "string" && typeof v.name === "string" && Array.isArray(v.filters),
    );
  } catch {
    return [];
  }
}
