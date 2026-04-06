import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useRef, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "@/components/admin/UserManagement";
import EventControlRoom from "@/components/admin/EventControlRoom";
import AdminDoorScanner from "@/components/admin/AdminDoorScanner";
import FamilyManagement from "@/components/admin/FamilyManagement";
import AllGuestApprovals from "@/components/admin/AllGuestApprovals";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import { Users, CalendarPlus, ScanLine, Home, ScrollText, Settings, BarChart3 } from "lucide-react";
import EventTypeManagement from "@/components/admin/EventTypeManagement";
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data: pendingCount } = usePendingUsersCount();
  const tabsListRef = useRef<HTMLDivElement>(null);

  const scrollActiveTabIntoView = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const activeTab = container.querySelector('[data-state="active"]') as HTMLElement;
    if (activeTab) {
      const scrollLeft = activeTab.offsetLeft - 8;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Scroll to show the active tab on mount
    const timer = setTimeout(() => scrollActiveTabIntoView(tabsListRef.current), 100);
    return () => clearTimeout(timer);
  }, [scrollActiveTabIntoView]);
  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  if (!isAdmin && !isModerator) {
    return <Navigate to="/" replace />;
  }

  const pendingBadge = isAdmin && !!pendingCount && pendingCount > 0 ? (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
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
        <Tabs defaultValue="users" className="w-full" onValueChange={() => setTimeout(() => scrollActiveTabIntoView(tabsListRef.current), 50)}>
          <TabsList ref={tabsListRef} className="flex w-full overflow-x-auto bg-muted scrollbar-hide pb-0.5">
            <TabsTrigger value="users" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              Users
              {pendingBadge}
            </TabsTrigger>
            <TabsTrigger value="families" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm">
              <Home className="h-4 w-4" />
              Families
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm">
              <CalendarPlus className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm bg-primary/10 text-primary font-semibold border border-primary/30 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ScanLine className="h-4 w-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-shrink-0 gap-1.5 px-3 text-xs sm:text-sm">
              <ScrollText className="h-4 w-4" />
              Log
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
          <TabsContent value="analytics">
            <AdminAnalytics />
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
