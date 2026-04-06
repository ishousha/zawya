import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "@/components/admin/UserManagement";
import EventControlRoom from "@/components/admin/EventControlRoom";
import AdminDoorScanner from "@/components/admin/AdminDoorScanner";
import FamilyManagement from "@/components/admin/FamilyManagement";
import AllGuestApprovals from "@/components/admin/AllGuestApprovals";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import { Users, CalendarPlus, ScanLine, Home, ScrollText, Settings } from "lucide-react";
import EventTypeManagement from "@/components/admin/EventTypeManagement";
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data: pendingCount } = usePendingUsersCount();

  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  if (!isAdmin && !isModerator) {
    return <Navigate to="/" replace />;
  }

  const pendingBadge = isAdmin && !!pendingCount && pendingCount > 0 ? (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
      {pendingCount > 99 ? "99+" : pendingCount}
    </span>
  ) : null;

  // Moderators see: Events, Guest Requests, Scanner
  // Admins see: Users, Families, Events, Scanner (guest requests inside Users tab)
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
          <Tabs defaultValue="events" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="events" className="gap-1.5 text-xs sm:text-sm">
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Events</span>
              </TabsTrigger>
              <TabsTrigger value="guests" className="gap-1.5 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Guests</span>
              </TabsTrigger>
              <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm">
                <ScanLine className="h-4 w-4" />
                <span className="hidden sm:inline">Scanner</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              <EventControlRoom />
            </TabsContent>
            <TabsContent value="guests">
              <AllGuestApprovals />
            </TabsContent>
            <TabsContent value="scanner">
              <AdminDoorScanner />
            </TabsContent>
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
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-muted">
            <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
              {pendingBadge}
            </TabsTrigger>
            <TabsTrigger value="families" className="gap-1.5 text-xs sm:text-sm">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Families</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5 text-xs sm:text-sm">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm">
              <ScanLine className="h-4 w-4" />
              <span className="hidden sm:inline">Scanner</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs sm:text-sm">
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
          <TabsContent value="families">
            <FamilyManagement />
          </TabsContent>
          <TabsContent value="events">
            <EventControlRoom />
          </TabsContent>
          <TabsContent value="settings">
            <EventTypeManagement />
          </TabsContent>
          <TabsContent value="scanner">
            <AdminDoorScanner />
          </TabsContent>
          <TabsContent value="activity">
            <AdminActivityLog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
