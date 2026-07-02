// Shared parser for RSVP-related Postgres trigger errors so toasts can show
// exact attempted delta and remaining capacity consistently.

export interface CapacityErrorInfo {
  attempted: number;
  current: number;
  capacity: number;
  remaining: number;
  human: string;
}

export function parseCapacityError(rawMessage: string | undefined | null): CapacityErrorInfo | null {
  if (!rawMessage) return null;
  const isRsvp = rawMessage.includes("RSVP_CAPACITY_EXCEEDED");
  const isGuest = rawMessage.includes("GUEST_CAPACITY_EXCEEDED");
  if (!isRsvp && !isGuest) return null;

  const num = (key: string) => {
    const m = rawMessage.match(new RegExp(`${key}=(-?\\d+)`));
    return m ? parseInt(m[1], 10) : NaN;
  };
  const attempted = num("attempted");
  const current = num("current");
  const capacity = num("capacity");
  const remaining = num("remaining");

  // Extract a friendly sentence (after the prefix, before the machine tail)
  const after = rawMessage.replace(/^.*?(?:RSVP|GUEST)_CAPACITY_EXCEEDED:\s*/, "");
  const human = after.split(" attempted=")[0].trim();


  if ([attempted, current, capacity, remaining].some((n) => Number.isNaN(n))) {
    return { attempted: NaN, current: NaN, capacity: NaN, remaining: NaN, human };
  }
  return { attempted, current, capacity, remaining, human };
}

export function formatCapacityToast(info: CapacityErrorInfo): { title: string; description: string } {
  if (Number.isNaN(info.attempted)) {
    return { title: "Over capacity", description: info.human };
  }
  const seat = (n: number) => `${n} seat${Math.abs(n) === 1 ? "" : "s"}`;
  return {
    title: "Over capacity",
    description:
      `Tried to add ${seat(info.attempted)}. ` +
      `Only ${seat(info.remaining)} left (${info.current} / ${info.capacity} used).`,
  };
}

// Convenience: produce {title, description} for any RSVP error message,
// returning null if it isn't a capacity error.
export function capacityToastFromError(err: unknown): { title: string; description: string } | null {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : (err as any)?.message;
  const info = parseCapacityError(msg);
  return info ? formatCapacityToast(info) : null;
}
