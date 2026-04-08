import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
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

  // Onboarding gate: user has no family_id yet → show wizard
  // Skip if they're on /join-family (they may be accepting an invite)
  const needsOnboarding = !profile?.family_id;

  if (needsOnboarding) {
    return (
      <Routes>
        {joinFamilyRoute}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  // Approved / Admin
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/library" element={<Library />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/guidelines" element={<CommunityGuidelines readOnly />} />
        {joinFamilyRoute}
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </>
  );
}
