import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useRef, useEffect, useCallback, useState, lazy, Suspense } from "react";
import { useSwipeable } from "react-swipeable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarPlus, ScanLine, Home, ScrollText, Settings, BarChart3, BookOpen, Mic } from "lucide-react";
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount";
import { Loader2 } from "lucide-react";

const UserManagement = lazy(() => import("@/components/admin/UserManagement"));
const EventControlRoom = lazy(() => import("@/components/admin/EventControlRoom"));
const AdminDoorScanner = lazy(() => import("@/components/admin/AdminDoorScanner"));
const FamilyManagement = lazy(() => import("@/components/admin/FamilyManagement"));
const AllGuestApprovals = lazy(() => import("@/components/admin/AllGuestApprovals"));
const AdminActivityLog = lazy(() => import("@/components/admin/AdminActivityLog"));
const AdminAnalytics = lazy(() => import("@/components/admin/AdminAnalytics"));
const EventTypeManagement = lazy(() => import("@/components/admin/EventTypeManagement"));
const SpeakerManagement = lazy(() => import("@/components/admin/SpeakerManagement"));
const ResourceManagement = lazy(() => import("@/components/admin/ResourceManagement"));

const ADMIN_TABS = ["users", "families", "events", "scanner", "speakers", "resources", "analytics", "settings", "activity"] as const;
type AdminTab = typeof ADMIN_TABS[number];

const MODERATOR_TABS = ["events", "guests", "scanner"] as const;
type ModeratorTab = typeof MODERATOR_TABS[number];

/** Tags that should never trigger tab-swiping (form inputs, buttons, etc.) */
const SWIPE_BLOCKED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

/** Check if the swipe originated from a form element or horizontally-scrollable child */
function shouldBlockSwipe(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;

  // Block if the touch started on a form element
  if (el && SWIPE_BLOCKED_TAGS.has(el.tagName)) return true;

  // Block if inside a scrollable container
  while (el) {
    const style = window.getComputedStyle(el);
    const isScrollable =
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth;
    if (isScrollable) return true;
    if (el.dataset.swipeRoot !== undefined) break;
    el = el.parentElement;
  }
  return false;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data: pendingCount } = usePendingUsersCount();
  const tabsListRef = useRef<HTMLDivElement>(null);

  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  // Controlled tab state + slide direction
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [modTab, setModTab] = useState<ModeratorTab>("events");
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [slideKey, setSlideKey] = useState(0);

  const changeTab = useCallback((
    tabs: readonly string[],
    current: string,
    setter: (t: never) => void,
    direction: "left" | "right"
  ) => {
    const idx = tabs.indexOf(current);
    const next = direction === "left" ? idx + 1 : idx - 1;
    if (next < 0 || next >= tabs.length) return;
    setSlideDir(direction);
    setSlideKey((k) => k + 1);
    setter(tabs[next] as never);
  }, []);

  /** Scroll the tab bar so the active tab is centered */
  const centerActiveTab = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const active = container.querySelector('[data-state="active"]') as HTMLElement;
    if (!active) return;
    const scrollLeft =
      active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }, []);

  // Center active tab whenever it changes
  useEffect(() => {
    const timer = setTimeout(() => centerActiveTab(tabsListRef.current), 60);
    return () => clearTimeout(timer);
  }, [activeTab, modTab, centerActiveTab]);

  // Admin swipe handler
  const adminSwipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(ADMIN_TABS, activeTab, setActiveTab, "left");
    },
    onSwipedRight: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(ADMIN_TABS, activeTab, setActiveTab, "right");
    },
    trackTouch: true,
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  // Moderator swipe handler
  const modSwipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(MODERATOR_TABS, modTab, setModTab, "left");
    },
    onSwipedRight: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(MODERATOR_TABS, modTab, setModTab, "right");
    },
    trackTouch: true,
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  if (!isAdmin && !isModerator) {
    return <Navigate to="/" replace />;
  }

  const pendingBadge = isAdmin && !!pendingCount && pendingCount > 0 ? (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
      {pendingCount > 99 ? "99+" : pendingCount}
    </span>
  ) : null;

  const tabTriggerBase =
    "flex-shrink-0 gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

  const scannerTrigger =
    "flex-shrink-0 gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md font-semibold transition-colors bg-primary/10 text-primary border border-primary/30 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-transparent";

  // Moderators: Events, Guest Requests, Scanner
  if (isModerator) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border bg-card px-4 pb-4 pt-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Moderator Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage events, guests & check-ins
          </p>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-4">
          <Tabs value={modTab} onValueChange={(v) => { setSlideDir(null); setSlideKey((k) => k + 1); setModTab(v as ModeratorTab); }} className="w-full">
            <TabsList ref={tabsListRef} className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="events" className="gap-1.5 text-xs sm:text-sm">
                <CalendarPlus className="h-4 w-4" />
                Events
              </TabsTrigger>
              <TabsTrigger value="guests" className="gap-1.5 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                Guests
              </TabsTrigger>
              <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm">
                <ScanLine className="h-4 w-4" />
                Check-in
              </TabsTrigger>
            </TabsList>

            <div {...modSwipeHandlers} data-swipe-root className={`touch-pan-y overflow-hidden ${slideDir === "left" ? "animate-slide-in-right" : slideDir === "right" ? "animate-slide-in-left" : "animate-fade-in-fast"}`} key={slideKey}>
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                <TabsContent value="events">
                  <EventControlRoom />
                </TabsContent>
                <TabsContent value="guests">
                  <AllGuestApprovals />
                </TabsContent>
                <TabsContent value="scanner">
                  <AdminDoorScanner />
                </TabsContent>
              </Suspense>
            </div>
          </Tabs>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your community
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <Tabs value={activeTab} onValueChange={(v) => { setSlideDir(null); setSlideKey((k) => k + 1); setActiveTab(v as AdminTab); }} className="w-full">
          <TabsList
            ref={tabsListRef}
            className="flex w-full justify-start overflow-x-auto bg-muted scrollbar-hide pb-0.5"
          >
            <TabsTrigger value="users" className={tabTriggerBase}>
              <Users className="h-4 w-4" />
              Users
              {pendingBadge}
            </TabsTrigger>
            <TabsTrigger value="families" className={tabTriggerBase}>
              <Home className="h-4 w-4" />
              Families
            </TabsTrigger>
            <TabsTrigger value="events" className={tabTriggerBase}>
              <CalendarPlus className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="scanner" className={scannerTrigger}>
              <ScanLine className="h-4 w-4" />
              Check-in
            </TabsTrigger>
            <TabsTrigger value="speakers" className={tabTriggerBase}>
              <Mic className="h-4 w-4" />
              Speakers
            </TabsTrigger>
            <TabsTrigger value="resources" className={tabTriggerBase}>
              <BookOpen className="h-4 w-4" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="analytics" className={tabTriggerBase}>
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className={tabTriggerBase}>
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="activity" className={tabTriggerBase}>
              <ScrollText className="h-4 w-4" />
              Log
            </TabsTrigger>
          </TabsList>

          <div {...adminSwipeHandlers} data-swipe-root className={`touch-pan-y overflow-hidden ${slideDir === "left" ? "animate-slide-in-right" : slideDir === "right" ? "animate-slide-in-left" : "animate-fade-in-fast"}`} key={slideKey}>
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <TabsContent value="users">
                <UserManagement />
              </TabsContent>
              <TabsContent value="families">
                <FamilyManagement />
              </TabsContent>
              <TabsContent value="events">
                <EventControlRoom />
              </TabsContent>
              <TabsContent value="scanner">
                <AdminDoorScanner />
              </TabsContent>
              <TabsContent value="speakers">
                <SpeakerManagement />
              </TabsContent>
              <TabsContent value="resources">
                <ResourceManagement />
              </TabsContent>
              <TabsContent value="analytics">
                <AdminAnalytics />
              </TabsContent>
              <TabsContent value="settings">
                <EventTypeManagement />
              </TabsContent>
              <TabsContent value="activity">
                <AdminActivityLog />
              </TabsContent>
            </Suspense>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
