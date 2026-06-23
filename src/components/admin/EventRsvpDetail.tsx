import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, X, Download, UserPlus, Mail, Printer, Users, UtensilsCrossed, CheckCircle2, Circle, Eye, Plus, Trash2, MessageCircle, ChevronDown, Pencil, ArrowUp } from "lucide-react";
import EditRsvpDialog from "./EditRsvpDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEventGuestRequests } from "@/hooks/useGuestRequests";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { downloadCsv, zawyaFilename } from "@/lib/csv-export";
import { toast } from "sonner";
import { format } from "date-fns";
import HostDashboard from "@/components/HostDashboard";
import AdminGuestApprovals from "./AdminGuestApprovals";
import CheckinPoster from "./CheckinPoster";
import WalkInRsvpModal from "./WalkInRsvpModal";
import WalkInGuestDialog from "./WalkInGuestDialog";
import { ageGroupLabel, ageGroupShort, deriveAgeGroup } from "@/lib/age-group-labels";

interface Props {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  checkinPin: string;
  hasPotluck: boolean;
  onClose: () => void;
}

export default function EventRsvpDetail({ eventId, eventTitle, eventDate, checkinPin: checkinPinProp, hasPotluck, onClose }: Props) {
  const queryClient = useQueryClient();
  const [showPoster, setShowPoster] = useState(false);

  // Fetch admin-only secrets (checkin_pin) via gated RPC so the events table
  // never exposes them through a direct SELECT.
  const { data: adminSecrets } = useQuery({
    queryKey: ["admin-event-secrets", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_event_admin_secrets", { _event_id: eventId });
      if (error) throw error;
      return (data && data[0]) || null;
    },
  });
  const checkinPin = (adminSecrets?.checkin_pin as string | undefined) || checkinPinProp || "";
  const [assignSelections, setAssignSelections] = useState<Record<number, string>>({});
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [sendingGuestList, setSendingGuestList] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    subject: string;
    html: string;
    recipients: { name: string | null; email: string }[];
    summary: { totalHeadcount: number; totalAdults: number; totalElders: number; totalChildren: number; guestCount: number; potluckCount: number };
  } | null>(null);

  // Fetch RSVPs + profiles
  const { data: rsvps, isLoading } = useQuery({
    queryKey: ["admin-rsvps", eventId],
    queryFn: async () => {
      const { data: rsvpData, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      if (!rsvpData || rsvpData.length === 0) return [];

      const userIds = [...new Set(rsvpData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, email, role, family_name, is_mureed")
        .in("id", userIds);

      const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
      return rsvpData.map((r) => ({ ...r, profile: profileMap.get(r.user_id) ?? null }));
    },
  });

  // Fetch sign-up items + selections for potluck
  const { data: signUpData } = useQuery({
    queryKey: ["admin-signup-items", eventId, (rsvps ?? []).map((r) => r.id).sort().join(",")],
    enabled: hasPotluck && !!rsvps,
    queryFn: async () => {
      const { data: items, error: iErr } = await supabase
        .from("event_sign_up_items")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index");
      if (iErr) throw iErr;
      if (!items || items.length === 0) return { items: [], selections: [] };

      const rsvpIds = (rsvps ?? []).map((r) => r.id);
      if (rsvpIds.length === 0) return { items, selections: [] };

      const { data: selections, error: sErr } = await supabase
        .from("rsvp_sign_up_selections")
        .select("*")
        .in("rsvp_id", rsvpIds);
      if (sErr) throw sErr;

      return { items, selections: selections ?? [] };
    },
  });

  const attending = useMemo(() => (rsvps ?? []).filter((r) => r.status === "attending" && !r.is_waitlisted), [rsvps]);
  const waitlisted = useMemo(() => (rsvps ?? []).filter((r) => r.status === "waitlisted" || r.is_waitlisted), [rsvps]);

  const invalidatePotluck = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-signup-items", eventId] });
    queryClient.invalidateQueries({ queryKey: ["potluck-menu", eventId] });
    queryClient.invalidateQueries({ queryKey: ["signup-claims", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-selections", eventId] });
  };

  const assignItem = useMutation({
    mutationFn: async ({ itemId, rsvpId }: { itemId: number; rsvpId: string }) => {
      const { error } = await supabase
        .from("rsvp_sign_up_selections")
        .insert({ sign_up_item_id: itemId, rsvp_id: rsvpId, quantity: 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePotluck();
      toast.success("Item assigned");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to assign"),
  });

  const removeAssignment = useMutation({
    mutationFn: async (selectionId: number) => {
      const { error } = await supabase
        .from("rsvp_sign_up_selections")
        .delete()
        .eq("id", selectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePotluck();
      toast.success("Assignment removed");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to remove"),
  });

  const toggleCheckin = useMutation({
    mutationFn: async (vars: {
      rsvpId: string;
      next: boolean;
      name: string;
      userId: string;
      email: string | null;
    }) => {
      const { error } = await supabase
        .from("rsvps")
        .update({ checked_in: vars.next })
        .eq("id", vars.rsvpId);
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData.user?.id;
      if (actorId) {
        await supabase.from("admin_activity_log").insert({
          actor_id: actorId,
          action: vars.next ? "checkin_rsvp" : "undo_checkin",
          target_user_id: vars.userId,
          target_user_name: vars.name,
          target_user_email: vars.email,
          details: {
            event_id: eventId,
            event_title: eventTitle,
            rsvp_id: vars.rsvpId,
          },
        });
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["host-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["door-attendees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-checkin-log", eventId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-log"] });
      toast.success(vars.next ? `Checked in ${vars.name}` : `Undid check-in for ${vars.name}`);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update check-in"),
  });

  const [undoTarget, setUndoTarget] = useState<{
    rsvpId: string;
    name: string;
    userId: string;
    email: string | null;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ rsvpId: string; name: string; userId: string; email: string | null } | null>(null);

  const removeRsvp = useMutation({
    mutationFn: async (vars: { rsvpId: string; name: string; userId: string; email: string | null }) => {
      const { error } = await supabase.from("rsvps").delete().eq("id", vars.rsvpId);
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData.user?.id;
      if (actorId) {
        await supabase.from("admin_activity_log").insert({
          actor_id: actorId,
          action: "rsvp_admin_remove",
          target_user_id: vars.userId,
          target_user_name: vars.name,
          target_user_email: vars.email,
          details: { event_id: eventId, event_title: eventTitle, rsvp_id: vars.rsvpId },
        });
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["host-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-rsvp-counts", eventId] });
      queryClient.invalidateQueries({ queryKey: ["existing-rsvp-users", eventId] });
      toast.success(`Removed RSVP for ${vars.name}`);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to remove RSVP"),
  });

  const promoteFromWaitlist = useMutation({
    mutationFn: async (vars: { rsvpId: string; name: string; userId: string; email: string | null }) => {
      const { error } = await supabase
        .from("rsvps")
        .update({ status: "attending" as any, is_waitlisted: false })
        .eq("id", vars.rsvpId);
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData.user?.id;
      if (actorId) {
        await supabase.from("admin_activity_log").insert({
          actor_id: actorId,
          action: "rsvp_admin_promote",
          target_user_id: vars.userId,
          target_user_name: vars.name,
          target_user_email: vars.email,
          details: { event_id: eventId, event_title: eventTitle, rsvp_id: vars.rsvpId },
        });
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["host-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-rsvp-counts", eventId] });
      toast.success(`Moved ${vars.name} to Attending`);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to promote RSVP"),
  });


  // Per-event check-in audit trail (latest entry per rsvp shown inline)
  const { data: checkinAudit } = useQuery({
    queryKey: ["event-checkin-log", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_activity_log")
        .select("id, action, actor_id, created_at, details")
        .in("action", ["checkin_rsvp", "undo_checkin"])
        .contains("details", { event_id: eventId })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorIds = useMemo(
    () => [...new Set((checkinAudit ?? []).map((l) => l.actor_id))],
    [checkinAudit],
  );
  const { data: actorProfiles } = useQuery({
    queryKey: ["checkin-actors", actorIds.sort().join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", actorIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const actorMap = useMemo(() => {
    const m = new Map<string, string>();
    (actorProfiles ?? []).forEach((p: any) => m.set(p.id, p.name || "Admin"));
    return m;
  }, [actorProfiles]);
  const latestAuditByRsvp = useMemo(() => {
    const m = new Map<string, { action: string; actor_id: string; created_at: string }>();
    (checkinAudit ?? []).forEach((row: any) => {
      const rsvpId = (row.details as any)?.rsvp_id as string | undefined;
      if (rsvpId && !m.has(rsvpId)) m.set(rsvpId, row);
    });
    return m;
  }, [checkinAudit]);

  const reassignItem = useMutation({
    mutationFn: async ({ selectionId, rsvpId }: { selectionId: number; rsvpId: string }) => {
      const { error } = await supabase
        .from("rsvp_sign_up_selections")
        .update({ rsvp_id: rsvpId })
        .eq("id", selectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePotluck();
      toast.success("Item reassigned");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to reassign"),
  });

  // Build potluck table rows
  const potluckRows = useMemo(() => {
    if (!signUpData) return [];
    const { items, selections } = signUpData;
    const rsvpMap = new Map((rsvps ?? []).map((r) => [r.id, r]));

    return items.map((item) => {
      const itemSelections = selections.filter((s) => s.sign_up_item_id === item.id);
      const totalClaimed = itemSelections.reduce((sum, s) => sum + (s.quantity ?? 1), 0);
      const claimants = itemSelections.map((s) => {
        const rsvp = rsvpMap.get(s.rsvp_id);
        const name = (rsvp?.profile as any)?.name || "Unknown";
        return { selectionId: s.id, rsvpId: s.rsvp_id, name, quantity: s.quantity ?? 1, description: s.description || "" };
      });
      return {
        id: item.id,
        itemName: item.item_name,
        quantityLimit: item.quantity_limit,
        totalClaimed,
        claimants,
      };
    });
  }, [signUpData, rsvps]);

  // Also gather legacy potluck items (specific_food_item on rsvps)
  const legacyPotluckItems = useMemo(() => {
    return (rsvps ?? [])
      .filter((r) => r.specific_food_item?.trim())
      .map((r) => ({
        dish: r.specific_food_item!,
        name: (r.profile as any)?.name || "Unknown",
      }));
  }, [rsvps]);

  const handleSendGuestList = async () => {
    setSendingGuestList(true);
    try {
      const { error } = await supabase.functions.invoke("send-guest-list-reminder", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      toast.success("Guest list sent to host, admins & moderators");
    } catch {
      toast.error("Failed to send guest list email");
    } finally {
      setSendingGuestList(false);
    }
  };

  const handlePreviewGuestList = async () => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-guest-list-reminder", {
        body: { event_id: eventId, preview: true },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) {
        toast.error("Preview failed", { description: result.error });
        return;
      }
      if (!result?.html) {
        toast.warning("Nothing to preview", { description: "No guest list could be generated." });
        return;
      }
      setPreviewData({
        subject: result.subject,
        html: result.html,
        recipients: result.recipients ?? [],
        summary: result.summary,
      });
    } catch (err: any) {
      console.error("preview guest list failed", err);
      toast.error("Preview failed", { description: err?.message || "Unknown error" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!attending || attending.length === 0) {
      toast.warning("No confirmed attendees to share yet.");
      return;
    }
    const totalGuests = attending.reduce((sum, r) => sum + (r.guests_count || 0), 0);
    const lines = attending.map((r, i) => {
      const name = (r.profile as any)?.name || "Unknown";
      const tix = r.guests_count || 1;
      return `${i + 1}. ${name} (x${tix})`;
    });
    const text =
      `Event: ${eventTitle}\n` +
      `Date: ${eventDate ? new Date(eventDate).toLocaleString() : ""}\n` +
      `Total Confirmed: ${totalGuests} (${attending.length} families)\n\n` +
      lines.join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleExportCsv = () => {
    if (!rsvps || rsvps.length === 0) return;

    // Build a map of rsvp_id -> potluck items claimed
    const rsvpPotluckMap = new Map<string, string[]>();
    if (signUpData) {
      for (const sel of signUpData.selections) {
        const item = signUpData.items.find((i) => i.id === sel.sign_up_item_id);
        const label = item ? `${item.item_name}${sel.description ? ` (${sel.description})` : ""} x${sel.quantity}` : "";
        if (label) {
          const existing = rsvpPotluckMap.get(sel.rsvp_id) ?? [];
          existing.push(label);
          rsvpPotluckMap.set(sel.rsvp_id, existing);
        }
      }
    }

    const rows = rsvps.map((r) => {
      const deps: any[] = (r.attending_dependents as any[]) ?? [];
      const depsOnly = deps.filter((d) => d.type === "dependent");
      const groupCounts = { infant_0_3: 0, child_4_12: 0, youth_13_17: 0, elder: 0 };
      for (const d of depsOnly) {
        const k = deriveAgeGroup(d);
        if (k && k in groupCounts) (groupCounts as any)[k]++;
      }
      const potluckFromSignUp = rsvpPotluckMap.get(r.id)?.join("; ") ?? "";
      const potluckLegacy = r.specific_food_item?.trim() ?? "";
      const potluckCombined = [potluckFromSignUp, potluckLegacy].filter(Boolean).join("; ");

      return {
        "Member Name": (r.profile as any)?.name || "",
        Email: (r.profile as any)?.email || "",
        "Dependents/Guests": deps.map((d) => d.name).join("; "),
        "Age Groups": deps.map((d) => ageGroupShort(d)).join("; "),
        "Infants (0-3)": groupCounts.infant_0_3,
        "Kids (4-12)": groupCounts.child_4_12,
        "Youth (13-17)": groupCounts.youth_13_17,
        "Elders": groupCounts.elder,
        "Total Party Size": r.guests_count,
        Status: r.is_waitlisted ? "Waitlisted" : r.status === "cancelled" ? "Cancelled" : "Attending",
        "Checked In": r.checked_in ? "Yes" : "No",
        "Potluck Items": potluckCombined,
      };
    });

    downloadCsv(rows, zawyaFilename("GuestList", eventTitle));
    toast.success(`Exported ${rows.length} RSVPs`);
  };

  if (showPoster) {
    return (
      <CheckinPoster
        eventTitle={eventTitle}
        eventDate={eventDate}
        eventId={eventId}
        checkinPin={checkinPin}
        onClose={() => setShowPoster(false)}
      />
    );
  }

  const getDepsDisplay = (r: any) => {
    const deps: any[] = r.attending_dependents ?? [];
    if (deps.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="space-y-0.5">
        {deps.map((d, i) => {
          const groupKey = deriveAgeGroup(d);
          const isDependent = d.type === "dependent";
          return (
            <p key={i} className="text-xs flex items-center gap-1.5 flex-wrap">
              <span>{d.name}</span>
              {isDependent && groupKey && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                  {ageGroupShort(d)}
                </Badge>
              )}
              {isDependent && !groupKey && d.age != null && (
                <span className="text-muted-foreground">({d.age})</span>
              )}
            </p>
          );
        })}
      </div>
    );
  };


  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{eventTitle}</CardTitle>
              <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs" onClick={() => setShowWalkIn(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Add Attendee
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowAddGuest(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Add Guest
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv} disabled={!rsvps || rsvps.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleShareWhatsApp} disabled={attending.length === 0}>
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handlePreviewGuestList} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Preview
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleSendGuestList} disabled={sendingGuestList}>
                {sendingGuestList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Send Guest List
              </Button>
              {checkinPin && (
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowPoster(true)}>
                  <Printer className="h-3.5 w-3.5" /> Poster
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : rsvps && rsvps.length > 0 ? (
            <div className="space-y-4">
              <HostDashboard eventId={eventId} hideGuestList />

              <Tabs defaultValue="guests" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="guests" className="gap-1.5 text-xs sm:text-sm">
                    <Users className="h-4 w-4" /> Guest List
                  </TabsTrigger>
                  <TabsTrigger value="potluck" className="gap-1.5 text-xs sm:text-sm" disabled={!hasPotluck}>
                    <UtensilsCrossed className="h-4 w-4" /> Potluck Sign-ups
                  </TabsTrigger>
                </TabsList>

                {/* Guest List Tab */}
                <TabsContent value="guests" className="space-y-4">
                  {/* Members & Mureeds Attending */}
                  <div>
                    {(() => {
                      const mureedCount = attending.filter((r) => (r.profile as any)?.is_mureed).length;
                      return (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span>Members &amp; Mureeds ({attending.length})</span>
                          {mureedCount > 0 && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-accent text-accent-foreground bg-accent/10">
                              {mureedCount} mureed{mureedCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </p>
                      );
                    })()}
                    {attending.length > 0 ? (
                      <div className="overflow-x-auto -mx-4 px-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Dependents</TableHead>
                              <TableHead className="text-xs text-center">Party</TableHead>
                              <TableHead className="text-xs text-center">Check-in</TableHead>
                              <TableHead className="text-xs text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attending.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium">{(r.profile as any)?.name || "Unknown"}</span>
                                    {(r.profile as any)?.is_mureed && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-accent text-accent-foreground bg-accent/10">
                                        Mureed
                                      </Badge>
                                    )}
                                    {(r.profile as any)?.role === "guest" && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Guest</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2">{getDepsDisplay(r)}</TableCell>
                                <TableCell className="py-2 text-center text-sm">{r.guests_count}</TableCell>
                                <TableCell className="py-2 text-center">
                                  {(() => {
                                    const profile = (r.profile as any) || {};
                                    const name = profile.name || "guest";
                                    const email = profile.email ?? null;
                                    const userId = r.user_id as string;
                                    const isPending = toggleCheckin.isPending && toggleCheckin.variables?.rsvpId === r.id;
                                    const audit = latestAuditByRsvp.get(r.id);
                                    return (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isPending) return;
                                            if (r.checked_in) {
                                              setUndoTarget({ rsvpId: r.id, name, userId, email });
                                            } else {
                                              toggleCheckin.mutate({ rsvpId: r.id, next: true, name, userId, email });
                                            }
                                          }}
                                          disabled={isPending}
                                          aria-label={r.checked_in ? `Undo check-in for ${name}` : `Mark ${name} as checked in`}
                                          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted/60 disabled:opacity-50 transition-colors"
                                        >
                                          {isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                          ) : r.checked_in ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                          ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground/40" />
                                          )}
                                        </button>
                                        {audit && (
                                          <span className="text-[10px] leading-tight text-muted-foreground">
                                            {audit.action === "undo_checkin" ? "undone" : "by"} {actorMap.get(audit.actor_id) || "Admin"}
                                            {" · "}
                                            {format(new Date(audit.created_at), "MMM d, h:mma")}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => setEditTarget(r)}
                                      title="Edit RSVP"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => setRemoveTarget({ rsvpId: r.id, name: (r.profile as any)?.name || "guest", userId: r.user_id as string, email: (r.profile as any)?.email ?? null })}
                                      title="Remove RSVP"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>

                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No confirmed members yet.</p>
                    )}
                  </div>

                  {/* External Guests (approved guest_requests) */}
                  <ExternalGuestsSection eventId={eventId} />


                  {/* Waitlisted */}
                  {waitlisted.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                        Waitlisted ({waitlisted.length})
                      </p>
                      <div className="overflow-x-auto -mx-4 px-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Dependents</TableHead>
                              <TableHead className="text-xs text-center">Party</TableHead>
                              <TableHead className="text-xs text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {waitlisted.map((r) => {
                              const name = (r.profile as any)?.name || "Unknown";
                              const email = (r.profile as any)?.email ?? null;
                              const userId = r.user_id as string;
                              return (
                                <TableRow key={r.id}>
                                  <TableCell className="py-2 text-sm font-medium">{name}</TableCell>
                                  <TableCell className="py-2">{getDepsDisplay(r)}</TableCell>
                                  <TableCell className="py-2 text-center text-sm">{r.guests_count}</TableCell>
                                  <TableCell className="py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-emerald-700 hover:text-emerald-800"
                                        title="Move to Attending"
                                        disabled={promoteFromWaitlist.isPending}
                                        onClick={() => promoteFromWaitlist.mutate({ rsvpId: r.id, name, userId, email })}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={() => setEditTarget(r)}
                                        title="Edit RSVP"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setRemoveTarget({ rsvpId: r.id, name, userId, email })}
                                        title="Remove RSVP"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Guest Requests (collapsible, scoped to this event) */}
                  <GuestRequestsSection eventId={eventId} />


                  <RsvpTotalsLine
                    eventId={eventId}
                    memberHeadcount={attending.reduce((s, r) => s + r.guests_count, 0)}
                    memberCount={attending.length}
                    mureedCount={attending.filter((r) => (r.profile as any)?.is_mureed).length}
                    waitlistedHeadcount={waitlisted.reduce((s, r) => s + r.guests_count, 0)}
                    waitlistedCount={waitlisted.length}
                  />
                </TabsContent>

                {/* Potluck Tab */}
                <TabsContent value="potluck" className="space-y-4">
                  {potluckRows.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-xs text-center">Needed</TableHead>
                            <TableHead className="text-xs text-center">Claimed</TableHead>
                            <TableHead className="text-xs">Claimed By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {potluckRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="py-2 text-sm font-medium">{row.itemName}</TableCell>
                              <TableCell className="py-2 text-center text-sm">
                                {row.quantityLimit === 0 ? "∞" : row.quantityLimit}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <Badge variant={row.quantityLimit > 0 && row.totalClaimed >= row.quantityLimit ? "default" : "outline"} className="text-xs">
                                  {row.totalClaimed}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="space-y-1.5">
                                  {row.claimants.map((c) => (
                                    <div key={c.selectionId} className="flex items-center gap-1.5 flex-wrap">
                                      <Select
                                        value={String(c.rsvpId ?? "")}
                                        onValueChange={(val) => {
                                          if (val && val !== String(c.rsvpId)) {
                                            reassignItem.mutate({ selectionId: c.selectionId, rsvpId: val });
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[160px]">
                                          <SelectValue>{c.name}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {attending.map((r: any) => (
                                            <SelectItem key={r.id} value={r.id} className="text-xs">
                                              {r.profile?.name || "Unknown"}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {c.description && <span className="text-[11px] text-muted-foreground">({c.description})</span>}
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => removeAssignment.mutate(c.selectionId)}
                                        title="Remove assignment"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                  {(row.quantityLimit === 0 || row.totalClaimed < row.quantityLimit) && (
                                    <div className="flex items-center gap-1.5">
                                      <Select
                                        value={assignSelections[row.id] || ""}
                                        onValueChange={(val) => setAssignSelections((s) => ({ ...s, [row.id]: val }))}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[160px]">
                                          <SelectValue placeholder="Assign to…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {attending.map((r: any) => (
                                            <SelectItem key={r.id} value={r.id} className="text-xs">
                                              {r.profile?.name || "Unknown"}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        disabled={!assignSelections[row.id]}
                                        onClick={() => {
                                          const rsvpId = assignSelections[row.id];
                                          if (rsvpId) {
                                            assignItem.mutate({ itemId: row.id, rsvpId });
                                            setAssignSelections((s) => ({ ...s, [row.id]: "" }));
                                          }
                                        }}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : legacyPotluckItems.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Dish</TableHead>
                            <TableHead className="text-xs">Brought By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {legacyPotluckItems.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="py-2 text-sm">{item.dish}</TableCell>
                              <TableCell className="py-2 text-sm text-muted-foreground">{item.name}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No potluck sign-ups yet.</p>
                  )}

                  {potluckRows.length > 0 && legacyPotluckItems.length > 0 && (
                    <div className="overflow-x-auto -mx-4 px-4">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 mt-4">Free-text contributions</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Dish</TableHead>
                            <TableHead className="text-xs">Brought By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {legacyPotluckItems.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="py-2 text-sm">{item.dish}</TableCell>
                              <TableCell className="py-2 text-sm text-muted-foreground">{item.name}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No RSVPs yet.</p>
          )}
        </CardContent>
      </Card>
      <WalkInRsvpModal eventId={eventId} open={showWalkIn} onOpenChange={setShowWalkIn} />
      <WalkInGuestDialog eventId={eventId} open={showAddGuest} onOpenChange={setShowAddGuest} />

      <Dialog open={!!previewData} onOpenChange={(o) => !o && setPreviewData(null)}>
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-4 sm:p-6 gap-3 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base">Guest List Email Preview</DialogTitle>
            <DialogDescription className="text-xs">
              Subject: <span className="font-medium text-foreground">{previewData?.subject}</span>
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="rounded-md border border-border p-3 bg-muted/30 text-xs space-y-2 shrink-0">
                <div>
                  <p className="font-semibold mb-1">Recipients ({previewData.recipients.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {previewData.recipients.map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {r.name ? `${r.name} <${r.email}>` : r.email}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground pt-1 border-t border-border/50">
                  <span>Total: <strong className="text-foreground">{previewData.summary.totalHeadcount}</strong></span>
                  <span>Adults: <strong className="text-foreground">{previewData.summary.totalAdults}</strong></span>
                  <span>Elders: <strong className="text-foreground">{previewData.summary.totalElders}</strong></span>
                  <span>Children: <strong className="text-foreground">{previewData.summary.totalChildren}</strong></span>
                  <span>RSVPs: <strong className="text-foreground">{previewData.summary.guestCount}</strong></span>
                  <span>Potluck: <strong className="text-foreground">{previewData.summary.potluckCount}</strong></span>
                </div>
              </div>

              <iframe
                title="Guest list email preview"
                srcDoc={previewData.html}
                className="w-full rounded-md border border-border bg-white min-h-[600px] shrink-0"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 shrink-0">
            <Button
              onClick={async () => {
                setPreviewData(null);
                await handleSendGuestList();
              }}
              disabled={sendingGuestList || !previewData?.recipients.length}
            >
              <Mail className="h-4 w-4 mr-1.5" /> Send Now
            </Button>
            <Button variant="outline" onClick={() => setPreviewData(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!undoTarget} onOpenChange={(o) => !o && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {undoTarget?.name} as not checked in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (undoTarget) {
                  toggleCheckin.mutate({ rsvpId: undoTarget.rsvpId, next: false, name: undoTarget.name, userId: undoTarget.userId, email: undoTarget.email });
                  setUndoTarget(null);
                }
              }}
            >
              Undo check-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditRsvpDialog
        rsvp={editTarget}
        eventTitle={eventTitle}
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove RSVP?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {removeTarget?.name}'s RSVP for "{eventTitle}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeTarget) {
                  removeRsvp.mutate(removeTarget);
                  setRemoveTarget(null);
                }
              }}
            >
              Remove RSVP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function GuestRequestsSection({ eventId }: { eventId: string }) {
  const { data: requests } = useEventGuestRequests(eventId);
  const total = requests?.length ?? 0;
  const pending = (requests ?? []).filter((r: any) => r.status === "pending").length;
  const [open, setOpen] = useState(pending > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-2 border-t border-border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between py-2 text-left hover:bg-muted/40 rounded-md px-2 -mx-2"
        >
          <span className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Guest Requests
            </span>
            {total > 0 && (
              <Badge variant={pending > 0 ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                {pending > 0 ? `${pending} pending` : `${total}`}
              </Badge>
            )}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <AdminGuestApprovals eventId={eventId} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExternalGuestsSection({ eventId }: { eventId: string }) {
  const { data: requests } = useEventGuestRequests(eventId);
  const { data: requesterRoles } = useQuery({
    queryKey: ["guest-requester-roles", eventId, (requests ?? []).map((r: any) => r.requesting_user_id).join(",")],
    enabled: !!requests && requests.length > 0,
    queryFn: async () => {
      const ids = [...new Set((requests ?? []).map((r: any) => r.requesting_user_id).filter(Boolean))] as string[];
      if (ids.length === 0) return new Map<string, string>();
      const { data } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const m = new Map<string, string>();
      for (const row of (data ?? []) as any[]) {
        // prefer admin/moderator label if present
        const existing = m.get(row.user_id);
        if (!existing || row.role === "admin" || row.role === "moderator") m.set(row.user_id, row.role);
      }
      return m;
    },
  });

  const approved = (requests ?? []).filter((r: any) => r.status === "approved");

  return (
    <div className="pt-2 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
        <span>External Guests ({approved.length})</span>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          approved
        </Badge>
      </p>
      {approved.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No approved external guests.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Guest</TableHead>
                <TableHead className="text-xs">Sponsor</TableHead>
                <TableHead className="text-xs">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.map((g: any) => {
                const requesterId = g.requesting_user_id;
                const role = requesterId ? requesterRoles?.get(requesterId) : undefined;
                const isWalkIn = !requesterId || role === "admin" || role === "moderator";
                const sponsorName = g.profiles?.name || "—";
                return (
                  <TableRow key={g.id}>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium">{g.guest_name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Guest</Badge>
                        {isWalkIn && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/40 text-primary">
                            Walk-in
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground">
                      {isWalkIn ? "Admin (walk-in)" : sponsorName}
                    </TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground">
                      {g.guest_phone || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RsvpTotalsLine({
  eventId,
  memberHeadcount,
  memberCount,
  mureedCount,
  waitlistedHeadcount,
  waitlistedCount,
}: {
  eventId: string;
  memberHeadcount: number;
  memberCount: number;
  mureedCount: number;
  waitlistedHeadcount: number;
  waitlistedCount: number;
}) {
  const { data: requests } = useEventGuestRequests(eventId);
  const guestCount = (requests ?? []).filter((r: any) => r.status === "approved").length;
  const totalHeadcount = memberHeadcount + guestCount;
  return (
    <p className="text-xs text-muted-foreground text-center pt-2 leading-relaxed">
      <span className="font-medium text-foreground">Members:</span> {memberCount}
      {mureedCount > 0 && ` (${mureedCount} mureed${mureedCount !== 1 ? "s" : ""})`}
      {" · "}
      <span className="font-medium text-foreground">External guests:</span> {guestCount}
      {" · "}
      <span className="font-medium text-foreground">Total headcount:</span> {totalHeadcount}
      {waitlistedCount > 0 && (
        <>
          <br />
          <span className="text-amber-600">Waitlisted:</span> {waitlistedHeadcount} ({waitlistedCount} families)
        </>
      )}
    </p>
  );
}

