import { format } from "date-fns";
import { Calendar, Clock, MapPin, Building2, Video, Users, Lock, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LazyImage from "@/components/LazyImage";
import { useEventTypes, getEventTypeIcon } from "@/hooks/useEventTypes";
import type { EventFormState } from "./types";

interface EventPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EventFormState;
}

export default function EventPreviewDialog({ open, onOpenChange, form }: EventPreviewDialogProps) {
  const { data: eventTypes } = useEventTypes();
  const eventType = eventTypes?.find((t) => t.id === form.event_type_id);
  const TypeIcon = eventType ? getEventTypeIcon(eventType.icon) : MapPin;
  const typeLabel = eventType?.name ?? "Event";

  const localDate = form.date_time ? new Date(form.date_time) : null;
  const isCancelled = form.status === "cancelled";
  const fee = parseFloat(form.ticket_fee) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-medium text-muted-foreground">
            Event Preview
          </DialogTitle>
        </DialogHeader>

        {/* Mock event card */}
        <div className="mx-4 mb-4 rounded-lg border bg-card overflow-hidden">
          {/* Cover Photo */}
          {form.cover_photo_url && (
            <div className="relative w-full h-40">
              <LazyImage
                src={form.cover_photo_url}
                alt={form.title || "Event cover"}
                className={`w-full h-full object-cover ${isCancelled ? "grayscale" : ""}`}
              />
              {isCancelled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="rounded-md bg-destructive px-3 py-1.5 text-sm font-bold uppercase tracking-wider text-destructive-foreground">
                    Cancelled
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="p-4">
            {/* Badges */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <TypeIcon className="h-3 w-3" />
                {typeLabel}
              </span>
              {form.mureeds_only && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  🔒 Private
                </span>
              )}
              {form.audience_gender === "Brothers Only" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  ♂ Brothers Only
                </span>
              )}
              {form.audience_gender === "Sisters Only" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-semibold text-pink-700 dark:text-pink-300">
                  ♀ Sisters Only
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-destructive-foreground">
                  <Ban className="h-3 w-3" />
                  Cancelled
                </span>
              )}
              {fee > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-foreground">
                  💰 Fee: {fee.toFixed(0)} AED
                </span>
              )}
              {(form.age_groups ?? []).filter((g) => g !== "All Ages").map((g) => (
                <span key={g} className="inline-flex items-center gap-1 rounded-full bg-[hsl(250,60%,95%)] px-2.5 py-0.5 text-xs font-medium text-[hsl(250,40%,35%)]">
                  👥 {g}
                </span>
              ))}
              {form.capacity && (
                <span className="ml-auto text-xs text-muted-foreground">
                  0/{form.capacity} spots
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-heading text-lg font-semibold text-card-foreground">
              {form.title || "Untitled Event"}
            </h3>

            {/* Description */}
            {form.description && (
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                {form.description}
              </p>
            )}

            {/* Date & Time */}
            {localDate && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(localDate, "EEE, MMM d")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {format(localDate, "h:mm a")}
                </span>
              </div>
            )}

            {/* Location hint (non-attending view) */}
            {form.location_hint && (
              <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {form.location_hint}{" "}
                  <span className="italic text-xs">(Exact address revealed after RSVP)</span>
                </span>
              </div>
            )}
            {!form.location_hint && form.location && (
              <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="italic">Location revealed after RSVP</span>
              </div>
            )}

            {/* Online link indicator */}
            {form.online_link && (
              <p className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-primary" />
                Virtual link available after RSVP
              </p>
            )}

            {/* Mock RSVP button */}
            <div className="mt-3">
              <Button size="sm" className="w-full" disabled>
                RSVP
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pb-3 px-4">
          This is how members will see the event before RSVPing
        </p>
      </DialogContent>
    </Dialog>
  );
}
