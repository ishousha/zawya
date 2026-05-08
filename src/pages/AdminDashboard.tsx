import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useRef, useEffect, useCallback, useState, lazy, Suspense, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarPlus, ScanLine, Home, ScrollText, Settings, BarChart3, BookOpen, Mic } from "lucide-react";
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount";
import { Loader2 } from "lucide-react";

const TabFallback = <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

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
const AnnouncementManagement = lazy(() => import("@/components/admin/AnnouncementManagement"));
const PotluckReclaimReport = lazy(() => import("@/components/admin/PotluckReclaimReport"));

const ADMIN_TABS = ["users", "families", "events", "scanner", "speakers", "resources", "analytics", "settings", "activity"] as const;
type AdminTab = typeof ADMIN_TABS[number];

const MODERATOR_TABS = ["events", "guests", "scanner"] as const;
type ModeratorTab = typeof MODERATOR_TABS[number];

/** Tags that should never trigger tab-swiping (form inputs, buttons, etc.) */
const SWIPE_BLOCKED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

/** Check if the swipe originated from a form element or horizontally-scrollable child */
function shouldBlockSwipe(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  if (el && SWIPE_BLOCKED_TAGS.has(el.tagName)) return true;
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

/** Keeps tab content mounted once visited, hidden with CSS when inactive */
function KeepAliveTab({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!visited) return null;
  return (
    <div className={active ? "mt-2" : "hidden"} role="tabpanel" data-tab={id}>
      <Suspense fallback={TabFallback}>{children}</Suspense>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data: pendingCount } = usePendingUsersCount();
  const tabsListRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [modTab, setModTab] = useState<ModeratorTab>("events");
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [slideKey, setSlideKey] = useState(0);

  // Honor navigation state from Quick Actions (tab switch only;
  // EventControlRoom reads location.state itself for action/eventId)
  useEffect(() => {
    const state = location.state as { tab?: string; action?: string; eventId?: string } | null;
    if (!state?.tab) return;
    if (isAdmin && (ADMIN_TABS as readonly string[]).includes(state.tab)) {
      setActiveTab(state.tab as AdminTab);
    } else if (isModerator && (MODERATOR_TABS as readonly string[]).includes(state.tab)) {
      setModTab(state.tab as ModeratorTab);
    }
    // If there's no further action/eventId, clear state here.
    // Otherwise leave it for EventControlRoom to consume + clear.
    if (!state.action && !state.eventId) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate, isAdmin, isModerator]);


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

  const centerActiveTab = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const active = container.querySelector('[data-state="active"]') as HTMLElement;
    if (!active) return;
    const scrollLeft =
      active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => centerActiveTab(tabsListRef.current), 60);
    return () => clearTimeout(timer);
  }, [activeTab, modTab, centerActiveTab]);

  const adminSwipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(ADMIN_TABS, activeTab, setActiveTab, "left");
    },
    onSwipedRight: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(ADMIN_TABS, activeTab, setActiveTab, "right");
    },
    trackTouch: true, trackMouse: false, delta: 50, preventScrollOnSwipe: false,
  });

  const modSwipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(MODERATOR_TABS, modTab, setModTab, "left");
    },
    onSwipedRight: (e) => {
      if (shouldBlockSwipe(e.event.target)) return;
      changeTab(MODERATOR_TABS, modTab, setModTab, "right");
    },
    trackTouch: true, trackMouse: false, delta: 50, preventScrollOnSwipe: false,
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

  // Moderators
  if (isModerator) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border bg-card px-4 pb-4 pt-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">Moderator Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage events, guests & check-ins</p>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-4">
          <Tabs value={modTab} onValueChange={(v) => { setSlideDir(null); setSlideKey((k) => k + 1); setModTab(v as ModeratorTab); }} className="w-full">
            <TabsList ref={tabsListRef} className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="events" className="gap-1.5 text-xs sm:text-sm"><CalendarPlus className="h-4 w-4" /> Events</TabsTrigger>
              <TabsTrigger value="guests" className="gap-1.5 text-xs sm:text-sm"><Users className="h-4 w-4" /> Guests</TabsTrigger>
              <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm"><ScanLine className="h-4 w-4" /> Check-in</TabsTrigger>
            </TabsList>

            <div {...modSwipeHandlers} data-swipe-root className={`touch-pan-y overflow-hidden ${slideDir === "left" ? "animate-slide-in-right" : slideDir === "right" ? "animate-slide-in-left" : "animate-fade-in-fast"}`} key={slideKey}>
              <KeepAliveTab id="events" active={modTab === "events"}><EventControlRoom /></KeepAliveTab>
              <KeepAliveTab id="guests" active={modTab === "guests"}><AllGuestApprovals /></KeepAliveTab>
              <KeepAliveTab id="scanner" active={modTab === "scanner"}><AdminDoorScanner /></KeepAliveTab>
            </div>
          </Tabs>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your community</p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <Tabs value={activeTab} onValueChange={(v) => { setSlideDir(null); setSlideKey((k) => k + 1); setActiveTab(v as AdminTab); }} className="w-full">
          <TabsList
            ref={tabsListRef}
            className="sticky top-[49px] z-20 flex w-full justify-start overflow-x-auto bg-background scrollbar-hide pb-0.5 border-b border-border/50 shadow-sm"
          >
            <TabsTrigger value="users" className={tabTriggerBase}><Users className="h-4 w-4" /> Users{pendingBadge}</TabsTrigger>
            <TabsTrigger value="families" className={tabTriggerBase}><Home className="h-4 w-4" /> Families</TabsTrigger>
            <TabsTrigger value="events" className={tabTriggerBase}><CalendarPlus className="h-4 w-4" /> Events</TabsTrigger>
            <TabsTrigger value="scanner" className={scannerTrigger}><ScanLine className="h-4 w-4" /> Check-in</TabsTrigger>
            <TabsTrigger value="speakers" className={tabTriggerBase}><Mic className="h-4 w-4" /> Special Guests</TabsTrigger>
            <TabsTrigger value="resources" className={tabTriggerBase}><BookOpen className="h-4 w-4" /> Resources</TabsTrigger>
            <TabsTrigger value="analytics" className={tabTriggerBase}><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
            <TabsTrigger value="settings" className={tabTriggerBase}><Settings className="h-4 w-4" /> Settings</TabsTrigger>
            <TabsTrigger value="activity" className={tabTriggerBase}><ScrollText className="h-4 w-4" /> Log</TabsTrigger>
          </TabsList>

          <div {...adminSwipeHandlers} data-swipe-root className={`touch-pan-y overflow-hidden ${slideDir === "left" ? "animate-slide-in-right" : slideDir === "right" ? "animate-slide-in-left" : "animate-fade-in-fast"}`} key={slideKey}>
            <KeepAliveTab id="users" active={activeTab === "users"}><UserManagement /></KeepAliveTab>
            <KeepAliveTab id="families" active={activeTab === "families"}><FamilyManagement /></KeepAliveTab>
            <KeepAliveTab id="events" active={activeTab === "events"}><EventControlRoom /></KeepAliveTab>
            <KeepAliveTab id="scanner" active={activeTab === "scanner"}><AdminDoorScanner /></KeepAliveTab>
            <KeepAliveTab id="speakers" active={activeTab === "speakers"}><SpeakerManagement /></KeepAliveTab>
            <KeepAliveTab id="resources" active={activeTab === "resources"}><ResourceManagement /></KeepAliveTab>
            <KeepAliveTab id="analytics" active={activeTab === "analytics"}><AdminAnalytics /></KeepAliveTab>
            <KeepAliveTab id="settings" active={activeTab === "settings"}>
              <div className="space-y-6">
                <PotluckReclaimReport />
                <AnnouncementManagement />
                <EventTypeManagement />
              </div>
            </KeepAliveTab>
            <KeepAliveTab id="activity" active={activeTab === "activity"}><AdminActivityLog /></KeepAliveTab>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
