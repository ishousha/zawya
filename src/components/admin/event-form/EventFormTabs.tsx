import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Card removed — using custom full-screen modal layout
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, X, Palette, PackagePlus, Settings, Eye, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import DesignTab from "./DesignTab";
import ItemsTab from "./ItemsTab";
import type { SignUpItem } from "./ItemsTab";
import SettingsTab from "./SettingsTab";
import { EventFormState, defaultEventForm, generateCheckinPin } from "./types";
import EventPreviewDialog from "./EventPreviewDialog";
import type { EventType } from "./types";
import type { Database } from "@/integrations/supabase/types";
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

const DRAFT_KEY = "zawya_event_draft";
const DRAFT_ITEMS_KEY = "zawya_event_draft_items";

function saveDraft(form: EventFormState, items: SignUpItem[]) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    localStorage.setItem(DRAFT_ITEMS_KEY, JSON.stringify(items));
  } catch { /* quota exceeded — ignore */ }
}

function loadDraft(): { form: EventFormState; items: SignUpItem[] } | null {
  try {
    const f = localStorage.getItem(DRAFT_KEY);
    const i = localStorage.getItem(DRAFT_ITEMS_KEY);
    if (!f) return null;
    return { form: JSON.parse(f), items: i ? JSON.parse(i) : [] };
  } catch { return null; }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(DRAFT_ITEMS_KEY);
}

type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface EventFormTabsProps {
  event?: EventRow;
  initialForm?: EventFormState;
  initialItems?: SignUpItem[];
  onClose: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

export default function EventFormTabs({ event, initialForm, initialItems, onClose }: EventFormTabsProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isNewEvent = !event || !!initialForm;
  // Track whether the event was already published before editing
  const wasAlreadyPublished = useRef(!!(event && (event as any).published));
  // Track original start time for Zoom auto-sync
  const originalDateTime = useRef(
    event?.date_time ? format(new Date(event.date_time), "yyyy-MM-dd'T'HH:mm") : ""
  );

  const [form, setForm] = useState<EventFormState>(() => {
    if (initialForm) return initialForm;
    if (!event) {
      const draft = loadDraft();
      return draft ? draft.form : defaultEventForm;
    }
    return {
      title: event.title,
      description: event.description ?? "",
      date_time: event.date_time ? format(new Date(event.date_time), "yyyy-MM-dd'T'HH:mm") : "",
      end_date_time: event.end_date_time ? format(new Date(event.end_date_time), "yyyy-MM-dd'T'HH:mm") : "",
      event_type_id: event.event_type_id,
      venue_id: event.venue_id ?? null,
      location: event.location ?? "",
      address: event.address ?? "",
      maps_url: (event as any).maps_url ?? "",
      virtual_link: event.virtual_link ?? event.zoom_link ?? "",
      cover_photo_url: event.cover_photo_url ?? null,
      capacity: event.capacity?.toString() ?? "",
      waitlist_capacity: (event.waitlist_capacity ?? 0).toString(),
      is_hybrid: event.is_hybrid ?? false,
      has_potluck: event.has_potluck ?? true,
      ticket_fee: (event.ticket_fee ?? 0).toString(),
      payment_instructions: event.payment_instructions ?? "",
      online_link: event.online_link ?? "",
      status: event.status,
      checkin_pin: event.checkin_pin ?? generateCheckinPin(),
      host_id: (event as any).host_id ?? null,
      mureeds_only: (event as any).mureeds_only ?? false,
      speaker_ids: [],
      notify_members: false,
      notify_attendees: false,
      etiquette_notes: (event as any).etiquette_notes ?? "",
      location_hint: (event as any).location_hint ?? "",
      age_group: (event as any).age_group ?? "All Ages",
      age_groups: Array.isArray((event as any).age_groups) && (event as any).age_groups.length > 0
        ? (event as any).age_groups
        : [(event as any).age_group ?? "All Ages"],
      audience_gender: ((event as any).audience_gender ?? "Everyone") as any,
      published: (event as any).published ?? false,
      scheduled_publish_at: (event as any).scheduled_publish_at
        ? format(new Date((event as any).scheduled_publish_at), "yyyy-MM-dd'T'HH:mm")
        : "",
      enable_virtual: !!(event.online_link),
      zoom_password: (event as any).zoom_password ?? "",
      recording_url: (event as any).recording_url ?? "",
      recording_passcode: (event as any).recording_passcode ?? "",
    };
  });

  const [signUpItems, setSignUpItems] = useState<SignUpItem[]>(() => {
    if (initialItems) return initialItems;
    if (!event) {
      const draft = loadDraft();
      return draft ? draft.items : [];
    }
    return [];
  });

  // --- Dirty tracking ---
  const initialFormRef = useRef(JSON.stringify(form));
  const initialItemsRef = useRef(JSON.stringify(signUpItems));
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isDirty = JSON.stringify(form) !== initialFormRef.current ||
    JSON.stringify(signUpItems) !== initialItemsRef.current;

  // Browser tab/window close guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Lock body scroll while the form is open to prevent mobile "wobble" / accidental edge-swipes
  useEffect(() => {
    const { body, documentElement: html } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      html.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    if (!isNewEvent) return;
    saveDraft(form, signUpItems);
  }, [form, signUpItems, isNewEvent]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowCloseConfirm(true);
      return;
    }
    if (isNewEvent) clearDraft();
    onClose();
  }, [isDirty, isNewEvent, onClose]);

  const confirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    if (isNewEvent) clearDraft();
    onClose();
  }, [isNewEvent, onClose]);

  const cancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  const { data: existingItems } = useQuery({
    queryKey: ["sign-up-items", event?.id],
    enabled: !!event?.id && !initialItems,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sign_up_items")
        .select("*")
        .eq("event_id", event!.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: existingSpeakers } = useQuery({
    queryKey: ["event-speakers", event?.id],
    enabled: !!event?.id && !initialForm,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("speaker_id")
        .eq("event_id", event!.id);
      if (error) throw error;
      return data.map((es) => es.speaker_id);
    },
  });

  useEffect(() => {
    if (existingItems && !initialItems) {
      setSignUpItems(
        existingItems.map((item) => ({
          id: Number(item.id),
          item_name: item.item_name,
          quantity_limit: item.quantity_limit,
          order_index: item.order_index,
        }))
      );
    }
  }, [existingItems, initialItems]);

  useEffect(() => {
    if (existingSpeakers && !initialForm) {
      setForm((prev) => ({ ...prev, speaker_ids: existingSpeakers }));
    }
  }, [existingSpeakers, initialForm]);

  const mutation = useMutation({
    mutationFn: async (publishOverride?: boolean) => {
      const shouldPublish = publishOverride ?? form.published;
      if (!form.title.trim()) throw new Error("Event title is required");
      if (!form.date_time) throw new Error("Start date and time is required");
      if (!form.event_type_id) throw new Error("Event type is required");

      const payload: any = {
        title: form.title,
        description: form.description || null,
        date_time: new Date(form.date_time).toISOString(),
        end_date_time: form.end_date_time ? new Date(form.end_date_time).toISOString() : null,
        event_type_id: form.event_type_id,
        location: form.location || null,
        address: form.address || null,
        maps_url: form.maps_url || null,
        venue_id: form.venue_id || null,
        virtual_link: form.virtual_link || null,
        zoom_link: form.virtual_link || null,
        cover_photo_url: form.cover_photo_url,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        waitlist_capacity: parseInt(form.waitlist_capacity) || 0,
        is_hybrid: form.enable_virtual && !!(form.location || form.venue_id),
        has_potluck: form.has_potluck,
        ticket_fee: parseFloat(form.ticket_fee) || 0,
        payment_instructions: form.payment_instructions || null,
        online_link: form.online_link || null,
        zoom_password: form.zoom_password || null,
        checkin_pin: form.checkin_pin || null,
        status: form.status,
        host_id: form.host_id || null,
        mureeds_only: form.mureeds_only === true,
        etiquette_notes: form.etiquette_notes || null,
        location_hint: form.location_hint || null,
        age_group: (form.age_groups && form.age_groups[0]) || form.age_group || "All Ages",
        age_groups: form.age_groups && form.age_groups.length > 0 ? form.age_groups : ["All Ages"],
        audience_gender: form.audience_gender || "Everyone",
        published: shouldPublish,
        ...(shouldPublish ? { last_published_at: new Date().toISOString() } : {}),
        scheduled_publish_at: !shouldPublish && form.scheduled_publish_at
          ? new Date(form.scheduled_publish_at).toISOString()
          : null,
        recording_url: form.recording_url || null,
        recording_passcode: form.recording_passcode || null,
      };

      let eventId = event?.id;
      if (event && !initialForm) {
        const { error } = await supabase.from("events").update(payload).eq("id", event.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert(payload).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }

      if (eventId) {
        // Run sign-up items and speakers operations in parallel
        const parallelOps: Promise<void>[] = [];

        // Sign-up items
        parallelOps.push((async () => {
          if (event && !initialForm) {
            const { error: deleteItemsError } = await supabase.from("event_sign_up_items").delete().eq("event_id", eventId!);
            if (deleteItemsError) throw deleteItemsError;
          }
          if (signUpItems.length > 0) {
            const rows = signUpItems.map((item, i) => ({
              event_id: eventId,
              item_name: item.item_name,
              quantity_limit: item.quantity_limit,
              order_index: i,
            }));
            const { error: signUpItemsError } = await supabase.from("event_sign_up_items").insert(rows);
            if (signUpItemsError) throw signUpItemsError;
          }
        })());

        // Speakers — sanitize to raw UUID strings in case objects leak in
        parallelOps.push((async () => {
          const { error: deleteSpeakersError } = await supabase.from("event_speakers").delete().eq("event_id", eventId!);
          if (deleteSpeakersError) throw deleteSpeakersError;
          const cleanSpeakerIds = form.speaker_ids
            .map((sid: any) => (typeof sid === "string" ? sid : sid?.id ?? sid?.speaker_id))
            .filter(Boolean) as string[];
          if (cleanSpeakerIds.length > 0) {
            const speakerRows = cleanSpeakerIds.map((sid, i) => ({
              event_id: eventId,
              speaker_id: sid,
              display_order: i,
            }));
            const { error: speakerInsertError } = await supabase.from("event_speakers").insert(speakerRows);
            if (speakerInsertError) throw speakerInsertError;
          }
        })());

        await Promise.all(parallelOps);

        // Notifications — only when transitioning from draft → published
        const isFirstPublish = shouldPublish && !wasAlreadyPublished.current;

        if (isFirstPublish) {
          (async () => {
            try {
              const { data: approvedUsers } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "approved");
              if (approvedUsers && approvedUsers.length > 0) {
                const eventUrl = `${window.location.origin}/events/${eventId}`;
                const dateStr = form.date_time
                  ? format(new Date(form.date_time), "EEEE, MMMM d 'at' h:mm a")
                  : "";
                const notifRows = approvedUsers.map((u) => ({
                  user_id: u.user_id,
                  title: "New Event: " + form.title,
                  message: `${form.title} — ${dateStr}. Tap to view and RSVP!`,
                  type: "event",
                  metadata: { action: "new_event", event_id: eventId, event_url: eventUrl },
                }));
                await supabase.from("notifications").insert(notifRows);
              }
            } catch (e) {
              console.warn("Failed to notify members:", e);
            }
          })();
        }

        // Notify existing attendees on update (only if already published and admin opts in)
        if (!isNewEvent && !isFirstPublish && shouldPublish && form.notify_attendees) {
          (async () => {
            try {
              const { data: rsvpUsers } = await supabase
                .from("rsvps")
                .select("user_id")
                .eq("event_id", eventId!);
              if (rsvpUsers && rsvpUsers.length > 0) {
                const uniqueIds = [...new Set(rsvpUsers.map((r) => r.user_id))];
                const notifRows = uniqueIds.map((uid) => ({
                  user_id: uid,
                  title: "Event Updated: " + form.title,
                  message: `"${form.title}" has been updated. Please review the latest details.`,
                  type: "event",
                  metadata: { action: "event_updated", event_id: eventId },
                }));
                await supabase.from("notifications").insert(notifRows);
              }
            } catch (e) {
              console.warn("Failed to notify attendees:", e);
            }
          })();
        }
      }

      return eventId;
    },
    onSuccess: (_data, publishOverride) => {
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["sign-up-items"] });
      queryClient.invalidateQueries({ queryKey: ["event-speakers"] });

      // Auto-sync Zoom meeting time if start_time changed + virtual + zoom link
      const timeChanged = originalDateTime.current && form.date_time !== originalDateTime.current;
      const hasZoomLink = form.enable_virtual && /zoom\.us/i.test(form.online_link);
      const meetingIdMatch = form.online_link.match(/\/j\/(\d+)/);

      if (timeChanged && hasZoomLink && meetingIdMatch) {
        const meetingId = meetingIdMatch[1];
        const startIso = new Date(form.date_time).toISOString();
        fetch("https://n8n.seqwelpartners.com/webhook/create-zoom-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.title, start_time: startIso, meeting_id: meetingId }),
        })
          .then((res) => {
            if (res.ok) {
              toast.success("Zoom meeting time auto-synced!");
            } else {
              toast.error("Event saved, but Zoom sync failed. Use the manual Update button.");
            }
          })
          .catch(() => {
            toast.error("Event saved, but Zoom sync failed. Use the manual Update button.");
          });
      }

      const isFirstPublish = publishOverride && !wasAlreadyPublished.current;
      if (isFirstPublish) {
        toast.success("Event is now live! Notifications have been sent to all members.");
      } else if (publishOverride) {
        toast.success("Event republished — no duplicate notifications sent.");
      } else {
        toast.success("Event saved as draft");
      }
      onClose();
      // Redirect admin to home so they see the result immediately
      navigate("/");
    },
    onError: (err) => {
      console.error("Event save error:", err);
      toast.error(getErrorMessage(err, "Failed to save event"));
    },
    onSettled: () => {},
  });

  // isNewEvent is declared at top of component

  return (
    <>
      {/* Full-screen overlay on mobile, card on desktop */}
      <div
        className="fixed inset-0 z-[60] bg-background overscroll-none md:flex md:items-center md:justify-center md:bg-black/60"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        {/* Clickable backdrop — only visible on desktop behind the card */}
        <div className="hidden md:block fixed inset-0" onClick={handleClose} />
        <div
          className="relative h-[100dvh] w-full flex flex-col bg-background md:h-[calc(100vh-6rem)] md:max-w-2xl md:rounded-lg md:border md:shadow-lg md:mx-4 md:z-10 [&_*]:box-border [&_input]:max-w-full [&_input]:w-full [&_textarea]:max-w-full [&_textarea]:w-full [&_select]:max-w-full [&_select]:w-full"
          style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none', overscrollBehaviorY: 'contain' }}
        >
          {/* Fixed header — not sticky, just shrink-0 in flex column */}
          <div className="flex items-center justify-between border-b bg-background px-4 py-3 shrink-0 z-20">
            <h2 className="text-lg font-heading font-semibold truncate">
              {isNewEvent ? "New Event" : "Edit Event"}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => setShowPreview(true)}
                disabled={!form.title}
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Scrollable form content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4" style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none', overscrollBehaviorY: 'contain' }}>
            <Tabs defaultValue="design" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted sticky top-0 z-10 mt-2">
                <TabsTrigger value="design" className="gap-1.5 text-xs">
                  <Palette className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="items" className="gap-1.5 text-xs">
                  <PackagePlus className="h-4 w-4" />
                  Items
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-1.5 text-xs">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="design" className="overflow-x-hidden">
                <DesignTab form={form} setForm={setForm} isEditing={!isNewEvent} />
              </TabsContent>
              <TabsContent value="items" className="overflow-x-hidden">
                <ItemsTab items={signUpItems} onChange={setSignUpItems} />
              </TabsContent>
              <TabsContent value="settings" className="overflow-x-hidden">
                <SettingsTab form={form} setForm={setForm} isEditing={!isNewEvent} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Compact sticky action bar — fixed to bottom on mobile */}
          <div className="w-full shrink-0 border-t bg-background px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-20 max-w-full overflow-hidden shadow-[0_-2px_8px_rgba(0,0,0,0.08)] md:px-4 md:py-3 md:pb-3">
            <div className="flex flex-row items-center gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 h-10 gap-1.5 text-sm"
                onClick={() => {
                  if (form.end_date_time && form.end_date_time <= form.date_time) {
                    toast.error("End time must be after start time");
                    return;
                  }
                  mutation.mutate(false);
                }}
                disabled={mutation.isPending || !form.title || !form.date_time}
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4 hidden sm:inline-block" />
                Save Draft
              </Button>
              <Button
                className="flex-1 h-10 gap-1.5 text-sm"
                onClick={() => {
                  if (form.end_date_time && form.end_date_time <= form.date_time) {
                    toast.error("End time must be after start time");
                    return;
                  }
                  mutation.mutate(true);
                }}
                disabled={mutation.isPending || !form.title || !form.date_time}
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4 hidden sm:inline-block" />
                {wasAlreadyPublished.current ? "Update" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <EventPreviewDialog open={showPreview} onOpenChange={setShowPreview} form={form} />

      <AlertDialog open={showCloseConfirm} onOpenChange={cancelClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved event details. Save as draft before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelClose}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
