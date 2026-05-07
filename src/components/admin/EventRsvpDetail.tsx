import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, X, Download, UserPlus, Mail, Printer, Users, UtensilsCrossed, CheckCircle2, Eye, Plus, Trash2 } from "lucide-react";
import { downloadCsv, zawyaFilename } from "@/lib/csv-export";
import { toast } from "sonner";
import HostDashboard from "@/components/HostDashboard";
import AdminGuestApprovals from "./AdminGuestApprovals";
import CheckinPoster from "./CheckinPoster";
import WalkInRsvpModal from "./WalkInRsvpModal";

interface Props {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  checkinPin: string;
  hasPotluck: boolean;
  onClose: () => void;
}

export default function EventRsvpDetail({ eventId, eventTitle, eventDate, checkinPin, hasPotluck, onClose }: Props) {
  const queryClient = useQueryClient();
  const [showPoster, setShowPoster] = useState(false);
  const [assignSelections, setAssignSelections] = useState<Record<number, string>>({});
  const [showWalkIn, setShowWalkIn] = useState(false);
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
        .select("id, name, email, role, family_name")
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
      const deps: { name: string }[] = (r.attending_dependents as any[]) ?? [];
      const potluckFromSignUp = rsvpPotluckMap.get(r.id)?.join("; ") ?? "";
      const potluckLegacy = r.specific_food_item?.trim() ?? "";
      const potluckCombined = [potluckFromSignUp, potluckLegacy].filter(Boolean).join("; ");

      return {
        "Member Name": (r.profile as any)?.name || "",
        Email: (r.profile as any)?.email || "",
        "Dependents/Guests": deps.map((d) => d.name).join("; "),
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
    const deps: { name: string; age?: number | null; type?: string; dependent_type?: string }[] = r.attending_dependents ?? [];
    if (deps.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="space-y-0.5">
        {deps.map((d, i) => (
          <p key={i} className="text-xs">
            {d.name}
            {d.age != null && <span className="text-muted-foreground ml-1">({d.age})</span>}
          </p>
        ))}
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
                <UserPlus className="h-3.5 w-3.5" /> Walk-In
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv} disabled={!rsvps || rsvps.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export CSV
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
              <HostDashboard eventId={eventId} />

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
                  {/* Attending */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Attending ({attending.length})
                    </p>
                    {attending.length > 0 ? (
                      <div className="overflow-x-auto -mx-4 px-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Dependents</TableHead>
                              <TableHead className="text-xs text-center">Party</TableHead>
                              <TableHead className="text-xs text-center">Check-in</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attending.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium">{(r.profile as any)?.name || "Unknown"}</span>
                                    {(r.profile as any)?.role === "guest" && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Guest</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2">{getDepsDisplay(r)}</TableCell>
                                <TableCell className="py-2 text-center text-sm">{r.guests_count}</TableCell>
                                <TableCell className="py-2 text-center">
                                  {r.checked_in ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                  ) : (
                                    <span className="text-muted-foreground/40">○</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No confirmed attendees yet.</p>
                    )}
                  </div>

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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {waitlisted.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="py-2 text-sm font-medium">{(r.profile as any)?.name || "Unknown"}</TableCell>
                                <TableCell className="py-2">{getDepsDisplay(r)}</TableCell>
                                <TableCell className="py-2 text-center text-sm">{r.guests_count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Guest Requests */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Guest Requests</p>
                    <AdminGuestApprovals eventId={eventId} />
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Total: {attending.reduce((s, r) => s + r.guests_count, 0)} attending
                    {waitlisted.length > 0 && ` · ${waitlisted.reduce((s, r) => s + r.guests_count, 0)} waitlisted`}
                  </p>
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
    </>
  );
}
