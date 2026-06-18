import { describe, it, expect } from "vitest";
import {
  matchesSearch,
  matchesStatusFilters,
  inDateRange,
  sortEvents,
  serializeViews,
  deserializeViews,
  type EventLike,
  type FilterKey,
  type SavedView,
} from "./event-filters";

const typeMap: Record<string, string> = { t1: "Halaqa", t2: "Potluck" };
const typeNameById = (id?: string | null) => (id ? typeMap[id] ?? "Event" : "Event");

const baseEvent = (over: Partial<EventLike>): EventLike => ({
  id: over.id ?? "e",
  title: over.title ?? "Untitled",
  date_time: over.date_time ?? "2026-07-01T18:00:00Z",
  end_date_time: over.end_date_time,
  location: over.location ?? null,
  address: over.address ?? null,
  published: over.published ?? false,
  scheduled_publish_at: over.scheduled_publish_at ?? null,
  status: over.status ?? "active",
  event_type_id: over.event_type_id ?? "t1",
  host: over.host ?? null,
});

describe("matchesSearch", () => {
  const ev = baseEvent({
    title: "Friday Halaqa",
    location: "Main Hall",
    address: "123 Olive St",
    event_type_id: "t1",
    host: { name: "Ahmed" },
  });

  it("matches by title", () => expect(matchesSearch(ev, "friday", typeNameById)).toBe(true));
  it("matches by location", () => expect(matchesSearch(ev, "main hall", typeNameById)).toBe(true));
  it("matches by address", () => expect(matchesSearch(ev, "olive", typeNameById)).toBe(true));
  it("matches by type name", () => expect(matchesSearch(ev, "halaqa", typeNameById)).toBe(true));
  it("matches by host name", () => expect(matchesSearch(ev, "ahmed", typeNameById)).toBe(true));
  it("returns true on empty query", () => expect(matchesSearch(ev, "  ", typeNameById)).toBe(true));
  it("returns false when nothing matches", () =>
    expect(matchesSearch(ev, "zzznope", typeNameById)).toBe(false));
});

describe("matchesStatusFilters", () => {
  const published = baseEvent({ published: true });
  const scheduled = baseEvent({ published: false, scheduled_publish_at: "2099-01-01" });
  const draft = baseEvent({ published: false });

  it("no status filters → all pass", () => {
    const f = new Set<FilterKey>(["upcoming"]);
    expect(matchesStatusFilters(published, f)).toBe(true);
    expect(matchesStatusFilters(draft, f)).toBe(true);
  });
  it("published filter only matches published", () => {
    const f = new Set<FilterKey>(["published"]);
    expect(matchesStatusFilters(published, f)).toBe(true);
    expect(matchesStatusFilters(draft, f)).toBe(false);
  });
  it("OR within status group", () => {
    const f = new Set<FilterKey>(["scheduled", "draft"]);
    expect(matchesStatusFilters(scheduled, f)).toBe(true);
    expect(matchesStatusFilters(draft, f)).toBe(true);
    expect(matchesStatusFilters(published, f)).toBe(false);
  });
});

describe("inDateRange", () => {
  const ev = baseEvent({ date_time: "2026-07-15T18:00:00Z" });
  it("no range → true", () => expect(inDateRange(ev, null)).toBe(true));
  it("inside range", () =>
    expect(inDateRange(ev, { from: "2026-07-01", to: "2026-07-31" })).toBe(true));
  it("before from", () =>
    expect(inDateRange(ev, { from: "2026-08-01", to: "2026-08-31" })).toBe(false));
  it("after to", () =>
    expect(inDateRange(ev, { from: "2026-06-01", to: "2026-06-30" })).toBe(false));
  it("inclusive bounds (end of day for to)", () =>
    expect(inDateRange(ev, { from: "2026-07-15", to: "2026-07-15" })).toBe(true));
});

describe("sortEvents", () => {
  const list = [
    baseEvent({ id: "a", date_time: "2026-01-01T00:00:00Z" }),
    baseEvent({ id: "b", date_time: "2026-06-01T00:00:00Z" }),
    baseEvent({ id: "c", date_time: "2026-03-01T00:00:00Z" }),
  ];
  it("oldest first", () =>
    expect(sortEvents(list, "oldest").map((e) => e.id)).toEqual(["a", "c", "b"]));
  it("newest first", () =>
    expect(sortEvents(list, "newest").map((e) => e.id)).toEqual(["b", "c", "a"]));
});

describe("saved views (de)serialize", () => {
  const views: SavedView[] = [
    {
      id: "v1",
      name: "Upcoming drafts",
      filters: ["upcoming", "draft"],
      search: "halaqa",
      sortOrder: "oldest",
      dateRange: { from: "2026-07-01", to: "2026-07-31" },
    },
  ];

  it("roundtrips", () => {
    const raw = serializeViews(views);
    expect(deserializeViews(raw)).toEqual(views);
  });
  it("returns [] for empty/invalid input", () => {
    expect(deserializeViews(null)).toEqual([]);
    expect(deserializeViews("not json")).toEqual([]);
    expect(deserializeViews("{}")).toEqual([]);
  });
});
