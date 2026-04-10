import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/Login";
import { usePendingUserAlerts } from "@/hooks/usePendingUserAlerts";
import Rejected from "@/pages/Rejected";
import CompleteProfile from "@/pages/CompleteProfile";
import PendingApproval from "@/pages/PendingApproval";
import Suspended from "@/pages/Suspended";
import HomeFeed from "@/pages/HomeFeed";
import EventDetail from "@/pages/EventDetail";
import ProfilePage from "@/pages/Profile";
import AdminDashboard from "@/pages/AdminDashboard";
import Unsubscribe from "@/pages/Unsubscribe";
import NotificationsPage from "@/pages/Notifications";
import CommunityGuidelines from "@/pages/CommunityGuidelines";
import JoinFamily, { consumePendingInviteToken } from "@/pages/JoinFamily";
import Onboarding from "@/pages/Onboarding";
import BottomNav from "@/components/BottomNav";
import AppHeader from "@/components/AppHeader";
import NotFound from "@/pages/NotFound";
import Library from "@/pages/Library";
import SpeakersDirectory from "@/pages/SpeakersDirectory";
import SpeakerProfile from "@/pages/SpeakerProfile";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
      <Routes>
        <Route path="/join-family" element={<JoinFamily />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Suspended users are blocked entirely
  if (profile?.role === "suspended") {
    return (
      <Routes>
        <Route path="*" element={<Suspended />} />
      </Routes>
    );
  }

  // Rejected users see a final decline screen
  if ((profile?.role as string) === "rejected") {
    return (
      <Routes>
        <Route path="*" element={<Rejected />} />
      </Routes>
    );
  }

  const joinFamilyRoute = <Route path="/join-family" element={<JoinFamily />} />;

  // Pending: needs onboarding if name or whatsapp missing
  if (profile?.role === "pending") {
    const needsOnboarding = !profile.name?.trim() || !profile.whatsapp_number?.trim();

    if (!needsOnboarding && !(profile as any).terms_accepted) {
      return (
        <Routes>
          {joinFamilyRoute}
          <Route path="*" element={<CommunityGuidelines />} />
        </Routes>
      );
    }

    return (
      <Routes>
        {joinFamilyRoute}
        <Route path="*" element={needsOnboarding ? <CompleteProfile /> : <PendingApproval />} />
      </Routes>
    );
  }

  // Terms gate for approved/admin users
  if (!(profile as any)?.terms_accepted) {
    return (
      <Routes>
        {joinFamilyRoute}
        <Route path="*" element={<CommunityGuidelines />} />
      </Routes>
    );
  }

  // Onboarding gate: check the explicit flag (not family_id which can be set later)
  const needsOnboarding = !(profile as any)?.onboarding_completed;

  if (needsOnboarding) {
    return (
      <Routes>
        {joinFamilyRoute}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Onboarding />} />
      </Routes>
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

  // Track which tabs have been visited so we only mount them on first visit
  const visitedRef = useMemo(() => new Set<string>(), []);
  if (stableTab) visitedRef.add(stableTab);

  const isStableRoute = stableTab !== null;

  return (
    <>
      <AppHeader />

      {/* Stable tab pages — kept mounted, hidden via CSS */}
      <div style={{ display: stableTab === "home" ? "block" : "none" }}>
        {visitedRef.has("home") && <HomeFeed />}
      </div>
      <div style={{ display: stableTab === "library" ? "block" : "none" }}>
        {visitedRef.has("library") && <Library />}
      </div>
      {(isAdmin || isModerator) && (
        <div style={{ display: stableTab === "admin" ? "block" : "none" }}>
          {visitedRef.has("admin") && <AdminDashboard />}
        </div>
      )}
      <div style={{ display: stableTab === "profile" ? "block" : "none" }}>
        {visitedRef.has("profile") && <ProfilePage />}
      </div>

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

      <BottomNav />
    </>
  );
}
