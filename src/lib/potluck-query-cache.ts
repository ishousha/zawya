import type { QueryClient } from "@tanstack/react-query";

const eventPotluckQueryKeys = (eventId: string) => [
  ["admin-rsvps", eventId],
  ["admin-signup-items", eventId],
  ["event-selections", eventId],
  ["host-rsvps", eventId],
  ["potluck-menu", eventId],
  ["potluck-signup-items", eventId],
  ["rsvps", eventId],
  ["sign-up-items", eventId],
] as const;

export function invalidateEventPotluckQueries(queryClient: QueryClient, eventId: string | null | undefined) {
  if (!eventId) return Promise.resolve();

  return Promise.all([
    ...eventPotluckQueryKeys(eventId).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    queryClient.invalidateQueries({ queryKey: ["my-selections"] }),
  ]).then(() => undefined);
}