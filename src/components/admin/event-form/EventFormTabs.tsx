import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, X, Palette, PackagePlus, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import DesignTab from "./DesignTab";
import ItemsTab from "./ItemsTab";
import type { SignUpItem } from "./ItemsTab";
import SettingsTab from "./SettingsTab";
import { EventFormState, defaultEventForm, generateCheckinPin } from "./types";
import type { EventType } from "./types";
import type { Database } from "@/integrations/supabase/types";

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

export default function EventFormTabs({ event, initialForm, initialItems, onClose }: EventFormTabsProps) {
  const queryClient = useQueryClient();

  const isNewEvent = !event || !!initialForm;

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

  // Auto-save draft for new events
  useEffect(() => {
    if (!isNewEvent) return;
    saveDraft(form, signUpItems);
  }, [form, signUpItems, isNewEvent]);

  // Handle cancel/discard — clear draft
  const handleClose = useCallback(() => {
    if (isNewEvent) clearDraft();
    onClose();
  }, [isNewEvent, onClose]);

  // Load existing sign-up items when editing (not duplicating)
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

  // Load existing speakers when editing
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
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        date_time: new Date(form.date_time).toISOString(),
        end_date_time: form.end_date_time ? new Date(form.end_date_time).toISOString() : null,
        event_type_id: form.event_type_id,
        location: form.location || null,
        address: form.address || null,
        venue_id: form.venue_id || null,
        virtual_link: form.virtual_link || null,
        zoom_link: form.virtual_link || null,
        cover_photo_url: form.cover_photo_url,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        waitlist_capacity: parseInt(form.waitlist_capacity) || 0,
        is_hybrid: form.is_hybrid,
        has_potluck: form.has_potluck,
        ticket_fee: parseFloat(form.ticket_fee) || 0,
        payment_instructions: form.payment_instructions || null,
        online_link: form.online_link || null,
        checkin_pin: form.checkin_pin || null,
        status: form.status,
        host_id: form.host_id || null,
        mureeds_only: form.mureeds_only,
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

      // Save sign-up items
      if (eventId) {
        if (event && !initialForm) {
          await supabase.from("event_sign_up_items").delete().eq("event_id", eventId);
        }

        if (signUpItems.length > 0) {
          const rows = signUpItems.map((item, i) => ({
            event_id: eventId!,
            item_name: item.item_name,
            quantity_limit: item.quantity_limit,
            order_index: i,
          }));
          const { error } = await supabase.from("event_sign_up_items").insert(rows);
          if (error) throw error;
        }

        // Save event speakers
        await supabase.from("event_speakers").delete().eq("event_id", eventId);
        if (form.speaker_ids.length > 0) {
          const speakerRows = form.speaker_ids.map((sid, i) => ({
            event_id: eventId!,
            speaker_id: sid,
            display_order: i,
          }));
          await supabase.from("event_speakers").insert(speakerRows);
        }
      }
    },
    onSuccess: () => {
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["sign-up-items"] });
      queryClient.invalidateQueries({ queryKey: ["event-speakers"] });
      toast.success(event && !initialForm ? "Event updated" : "Event created");
      onClose();
    },
    onError: () => toast.error("Failed to save event"),
  });

  // isNewEvent is declared at top of component

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-heading">
          {isNewEvent ? "New Event" : "Edit Event"}
        </CardTitle>
        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={handleClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="design" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="design" className="gap-1.5 text-xs">
              <Palette className="h-4 w-4" />
              Design
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

          <TabsContent value="design">
            <DesignTab form={form} setForm={setForm} />
          </TabsContent>
          <TabsContent value="items">
            <ItemsTab items={signUpItems} onChange={setSignUpItems} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab form={form} setForm={setForm} />
          </TabsContent>
        </Tabs>

        <Button
          className="w-full h-12 mt-4"
          onClick={() => {
            if (form.end_date_time && form.end_date_time <= form.date_time) {
              toast.error("End time must be after start time");
              return;
            }
            mutation.mutate();
          }}
          disabled={mutation.isPending || !form.title || !form.date_time}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNewEvent ? "Create Event" : "Update Event"}
        </Button>
      </CardContent>
    </Card>
  );
}
