import { useCallback, useEffect, useRef, useState } from "react";

export type AppVersionStatus =
  | "checking"
  | "up-to-date"
  | "update-available"
  | "unknown";

export interface UseAppVersionResult {
  status: AppVersionStatus;
  localBuildTime: string;
  serverBuildTime: string | null;
  /** Re-fetch /version.json. Returns the new status. */
  recheck: () => Promise<AppVersionStatus>;
}

const SKEW_MS = 1000;

/**
 * Compares the bundled __APP_BUILD_TIME__ against /version.json on the server
 * to tell the user whether their installed build is current. Re-checks on
 * tab focus.
 */
export function useAppVersion(): UseAppVersionResult {
  const localBuildTime = __APP_BUILD_TIME__;
  const [serverBuildTime, setServerBuildTime] = useState<string | null>(null);
  const [status, setStatus] = useState<AppVersionStatus>("checking");
  const inFlightRef = useRef(false);

  const check = useCallback(async (): Promise<AppVersionStatus> => {
    if (inFlightRef.current) return status;
    inFlightRef.current = true;
    setStatus((prev) => (prev === "checking" ? prev : "checking"));
    try {
      const res = await fetch(`/version.json?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { buildTime?: string };
      const remote = json?.buildTime ?? null;
      setServerBuildTime(remote);

      if (!remote) {
        setStatus("unknown");
        return "unknown";
      }
      const localMs = Date.parse(localBuildTime);
      const remoteMs = Date.parse(remote);
      if (Number.isNaN(localMs) || Number.isNaN(remoteMs)) {
        setStatus("unknown");
        return "unknown";
      }
      const next: AppVersionStatus =
        remoteMs > localMs + SKEW_MS ? "update-available" : "up-to-date";
      setStatus(next);
      return next;
    } catch {
      setStatus("unknown");
      return "unknown";
    } finally {
      inFlightRef.current = false;
    }
  }, [localBuildTime, status]);

  useEffect(() => {
    void check();
    const onFocus = () => {
      void check();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // check is stable enough; we intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, localBuildTime, serverBuildTime, recheck: check };
}
