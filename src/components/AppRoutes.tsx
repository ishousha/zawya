import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingUserAlerts } from "@/hooks/usePendingUserAlerts";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Eagerly loaded (needed immediately for unauthenticated users)
import LoginPage from "@/pages/Login";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import OfflineBanner from "@/components/OfflineBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";

// Lazy-loaded pages
const Rejected = lazy(() => import("@/pages/Rejected"));
const CompleteProfile = lazy(() => import("@/pages/CompleteProfile"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));
const Suspended = lazy(() => import("@/pages/Suspended"));

const homeFeedImport = () => import("@/pages/HomeFeed");
const libraryImport = () => import("@/pages/Library");
const adminImport = () => import("@/pages/AdminDashboard");
const profileImport = () => import("@/pages/Profile");

const HomeFeed = lazy(homeFeedImport);
const EventDetail = lazy(() => import("@/pages/EventDetail"));
const ProfilePage = lazy(profileImport);
const AdminDashboard = lazy(adminImport);
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
const NotificationsPage = lazy(() => import("@/pages/Notifications"));
const CommunityGuidelines = lazy(() => import("@/pages/CommunityGuidelines"));
const JoinFamily = lazy(() => import("@/pages/JoinFamily"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Library = lazy(libraryImport);
const SpeakersDirectory = lazy(() => import("@/pages/SpeakersDirectory"));
const SpeakerProfile = lazy(() => import("@/pages/SpeakerProfile"));

function LazyFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const POST_LOGIN_REDIRECT_KEY = "zawya_post_login_redirect";

function isSafeRedirectPath(path: string | null): path is string {
  if (!path) return false;
  // Allowlist: event deep links and short-code links (prevents open-redirect)
  return (
    /^\/events\/[\w-]+(\?.*)?$/.test(path) ||
    /^\/e\/[A-Za-z0-9]{4,12}(\?.*)?$/.test(path)
  );
}

function usePendingInviteRedirect() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !session) return;
    // If user just logged in and there's a pending invite token, redirect
    if (location.pathname !== "/join-family") {
      const pendingToken = localStorage.getItem("zawya_family_invite_token");
      if (pendingToken) {
        navigate(`/join-family?token=${pendingToken}`, { replace: true });
      }
    }
  }, [session, loading]);
}

/**
 * Captures /events/:id deep links when a user is unauthenticated so they can
 * be redirected back after sign-in (sessionStorage survives OAuth round-trip).
 */
function useCaptureDeepLink(unauthenticated: boolean) {
  const location = useLocation();
  useEffect(() => {
    if (!unauthenticated) return;
    const path = location.pathname + location.search;
    if (isSafeRedirectPath(path)) {
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
      } catch {}
    }
  }, [unauthenticated, location.pathname, location.search]);
}

/**
 * After auth + onboarding gates pass, navigate to any saved deep link.
 */
function usePostLoginRedirect(active: boolean) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!active) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    } catch {}
    if (isSafeRedirectPath(saved)) {
      try { sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY); } catch {}
      navigate(saved, { replace: true });
    } else if (saved) {
      try { sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY); } catch {}
    }
  }, [active]);
}

export default function AppRoutes() {
  const { session, profile, loading } = useAuth();

  usePendingInviteRedirect();
  usePendingUserAlerts();
  useCaptureDeepLink(!loading && !session);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in — allow /join-family and /unsubscribe
  if (!session) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/join-family" element={<JoinFamily />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/event/:eventId" element={<LoginPage />} />
          <Route path="/events/:eventId" element={<LoginPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </Suspense>
    );
  }

  // Suspended users are blocked entirely
  if (profile?.role === "suspended") {
    return (
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="*" element={<Suspended />} />
        </Routes>
      </Suspense>
    );
  }

  // Rejected users see a final decline screen
  if ((profile?.role as string) === "rejected") {
    return (
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="*" element={<Rejected />} />
        </Routes>
      </Suspense>
    );
  }

  const joinFamilyRoute = <Route path="/join-family" element={<JoinFamily />} />;

  // Pending: needs onboarding if name or whatsapp missing
  if (profile?.role === "pending") {
    const needsOnboarding = !profile.name?.trim() || !profile.whatsapp_number?.trim();

    if (!needsOnboarding && !(profile as any).terms_accepted) {
      return (
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            {joinFamilyRoute}
            <Route path="*" element={<CommunityGuidelines />} />
          </Routes>
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          {joinFamilyRoute}
          <Route path="*" element={needsOnboarding ? <CompleteProfile /> : <PendingApproval />} />
        </Routes>
      </Suspense>
    );
  }

  // Terms gate removed for approved/admin users — guidelines are shown
  // only during the pending/sign-up flow (handled above at line 112).

  // Onboarding gate: check the explicit flag (not family_id which can be set later)
  const needsOnboarding = !(profile as any)?.onboarding_completed;

  if (needsOnboarding) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          {joinFamilyRoute}
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Onboarding />} />
        </Routes>
      </Suspense>
    );
  }

  // Approved / Admin — stable layout keeps Home/Library/Admin/Profile mounted
  return <StableLayout profile={profile} />;
}

/**
 * StableLayout keeps the four main tab pages mounted at all times (hidden via CSS)
 * so they preserve scroll position, component state, and avoid re-fetching on tab switch.
 */
function StableLayout({ profile }: { profile: any }) {
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  usePostLoginRedirect(true);

  // Preload all tab chunks after first paint so future tab switches are instant
  useEffect(() => {
    const timer = setTimeout(() => {
      homeFeedImport();
      libraryImport();
      profileImport();
      if (isAdmin || isModerator) adminImport();
    }, 500);
    return () => clearTimeout(timer);
  }, [isAdmin, isModerator]);

  // Track which tabs have been visited so we mount them on first visit and keep them alive
  const [visited, setVisited] = useState<Set<string>>(() => new Set());

  const stableTab = useMemo(() => {
    if (location.pathname === "/") return "home";
    if (location.pathname === "/library") return "library";
    if (location.pathname === "/admin" && (isAdmin || isModerator)) return "admin";
    if (location.pathname === "/profile") return "profile";
    return null;
  }, [location.pathname, isAdmin, isModerator]);

  // Mark tab as visited so it stays mounted
  useEffect(() => {
    if (stableTab && !visited.has(stableTab)) {
      setVisited((prev) => new Set(prev).add(stableTab));
    }
  }, [stableTab]);

  const isStableRoute = stableTab !== null;

  return (
    <>
      <OfflineBanner />
      <AnnouncementBanner />
      <AppHeader />

      <Suspense fallback={<LazyFallback />}>
        {/* Keep visited tabs mounted, hide inactive ones with CSS */}
        {(visited.has("home") || stableTab === "home") && (
          <div style={{ display: stableTab === "home" ? "block" : "none" }}>
            <HomeFeed />
          </div>
        )}
        {(visited.has("library") || stableTab === "library") && (
          <div style={{ display: stableTab === "library" ? "block" : "none" }}>
            <Library />
          </div>
        )}
        {(isAdmin || isModerator) && (visited.has("admin") || stableTab === "admin") && (
          <div style={{ display: stableTab === "admin" ? "block" : "none" }}>
            <AdminDashboard />
          </div>
        )}
        {(visited.has("profile") || stableTab === "profile") && (
          <div style={{ display: stableTab === "profile" ? "block" : "none" }}>
            <ProfilePage />
          </div>
        )}

        {/* Non-tab routes render normally */}
        {!isStableRoute && (
          <Routes>
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/event/:eventId" element={<EventAliasRedirect />} />
            <Route path="/speakers" element={<SpeakersDirectory />} />
            <Route path="/speakers/:speakerId" element={<SpeakerProfile />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/guidelines" element={<CommunityGuidelines readOnly />} />
            <Route path="/join-family" element={<JoinFamily />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </Suspense>

      <BottomNav />
    </>
  );
}

function EventAliasRedirect() {
  const location = useLocation();
  const id = location.pathname.split("/").pop() ?? "";
  return <Navigate to={`/events/${id}${location.search}`} replace />;
}

