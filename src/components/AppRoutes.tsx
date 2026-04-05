import { Routes, Route } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/Login";
import PendingApproval from "@/pages/PendingApproval";
import HomeFeed from "@/pages/HomeFeed";
import ProfilePage from "@/pages/Profile";
import AdminDashboard from "@/pages/AdminDashboard";
import BottomNav from "@/components/BottomNav";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

export default function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Pending: needs onboarding if name or whatsapp missing
  if (profile?.role === "pending") {
    const needsOnboarding = !profile.name?.trim() || !profile.whatsapp_number?.trim();
    return (
      <Routes>
        <Route path="*" element={needsOnboarding ? <CompleteProfile /> : <PendingApproval />} />
      </Routes>
    );
  }

  // Approved / Admin
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </>
  );
}