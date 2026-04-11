import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingUserAlerts } from "@/hooks/usePendingUserAlerts";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Eagerly loaded (needed immediately for unauthenticated users)
import LoginPage from "@/pages/Login";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

// Lazy-loaded pages
const Rejected = lazy(() => import("@/pages/Rejected"));
const CompleteProfile = lazy(() => import("@/pages/CompleteProfile"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));
const Suspended = lazy(() => import("@/pages/Suspended"));
const HomeFeed = lazy(() => import("@/pages/HomeFeed"));
const EventDetail = lazy(() => import("@/pages/EventDetail"));
const ProfilePage = lazy(() => import("@/pages/Profile"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
const NotificationsPage = lazy(() => import("@/pages/Notifications"));
const CommunityGuidelines = lazy(() => import("@/pages/CommunityGuidelines"));
const JoinFamily = lazy(() => import("@/pages/JoinFamily"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Library = lazy(() => import("@/pages/Library"));
const SpeakersDirectory = lazy(() => import("@/pages/SpeakersDirectory"));
const SpeakerProfile = lazy(() => import("@/pages/SpeakerProfile"));

function LazyFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
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

export default function AppRoutes() {
  const { session, profile, loading } = useAuth();

  usePendingInviteRedirect();
  usePendingUserAlerts();

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
 * so they preserve scroll position & component state across tab switches.
 * Non-tab routes (event detail, speakers, etc.) render normally via Routes.
 */
function StableLayout({ profile }: { profile: any }) {
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  // Determine which stable tab (if any) matches the current path
  const stableTab = useMemo(() => {
    if (location.pathname === "/") return "home";
    if (location.pathname === "/library") return "library";
    if (location.pathname === "/admin" && (isAdmin || isModerator)) return "admin";
    if (location.pathname === "/profile") return "profile";
    return null;
  }, [location.pathname, isAdmin, isModerator]);

  const isStableRoute = stableTab !== null;

  return (
    <>
      <OfflineBanner />
      <AppHeader />

      <Suspense fallback={<LazyFallback />}>
        {/* Only render the active tab to avoid hidden tabs running heavy queries in the background */}
        {stableTab === "home" && <HomeFeed />}
        {stableTab === "library" && <Library />}
        {stableTab === "admin" && (isAdmin || isModerator) && <AdminDashboard />}
        {stableTab === "profile" && <ProfilePage />}

        {/* Non-tab routes render normally */}
        {!isStableRoute && (
          <Routes>
            <Route path="/events/:eventId" element={<EventDetail />} />
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
