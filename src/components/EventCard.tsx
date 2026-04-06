import { useState, useEffect } from "react";
import { format } from "date-fns";
import { MapPin, Video, Users, Calendar, Clock, CheckCircle2, Ticket, Edit, Building2, ExternalLink, Ban, BookOpen, Mountain, Handshake, ClockIcon, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP, useEventRSVPs } from "@/hooks/useRSVP";
import { useEventTypes, getEventTypeIcon } from "@/hooks/useEventTypes";
import RSVPModal from "@/components/RSVPModal";
import SelfCheckinModal from "@/components/SelfCheckinModal";
import AddToCalendarButton from "@/components/AddToCalendarButton";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface EventCardProps {
  event: Event;
  onShowTicket?: (event: Event) => void;
}

export default function EventCard({ event, onShowTicket }: EventCardProps) {
  const localDate = new Date(event.date_time);
  const { data: eventTypes } = useEventTypes();
  const eventType = eventTypes?.find((t) => t.id === event.event_type_id);
  const TypeIcon = eventType ? getEventTypeIcon(eventType.icon) : MapPin;
  const typeLabel = eventType?.name ?? "Event";

  const { data: myRSVP } = useMyRSVP(event.id);
  const { data: allRsvps } = useEventRSVPs(event.id);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { profile } = useAuth();

  const isAttending = !!myRSVP;
  const isWaitlisted = myRSVP?.is_waitlisted ?? false;
  const isCancelled = event.status === "cancelled";

  const confirmedCount = allRsvps?.filter((r) => !r.is_waitlisted).length ?? 0;
  const isFull = !!event.capacity && confirmedCount >= event.capacity;

  // Time-gate: refresh every second for countdown
  const onlineLink = event.online_link;
  const eventTime = new Date(event.date_time).getTime();
  const linkActivatesAt = eventTime - 15 * 60 * 1000;
  const isLinkActive = now.getTime() >= linkActivatesAt;
  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";
  const canSeeJoinButton = isAdminOrMod || (isAttending && !isWaitlisted);

  // Countdown string
  const remainingMs = linkActivatesAt - now.getTime();
  const countdownText = (() => {
    if (isLinkActive || remainingMs <= 0) return "";
    const totalSec = Math.ceil(remainingMs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  })();

  useEffect(() => {
    if (!onlineLink || isLinkActive) return;
    const interval = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(interval);
  }, [onlineLink, isLinkActive]);

  // Calculate waitlist position for the current user
  const waitlistPosition = isWaitlisted && allRsvps
    ? allRsvps
        .filter((r) => r.is_waitlisted)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .findIndex((r) => r.user_id === myRSVP?.user_id) + 1
    : 0;

  // Check if this is a virtual-only event type (no location required)
  const requiresLocation = eventType?.requires_location ?? true;

  return (
    <>
      <div className={`animate-fade-in rounded-lg border bg-card overflow-hidden transition-shadow ${
        isCancelled
          ? "opacity-60 border-destructive/40"
          : isAttending
            ? "border-primary/40 hover:shadow-md"
            : "border-border hover:shadow-md"
      }`}>
        {/* Cover Photo */}
        {event.cover_photo_url && (
          <div className="relative w-full h-40">
            <img
              src={event.cover_photo_url}
              alt={event.title}
              className={`w-full h-full object-cover ${isCancelled ? "grayscale" : ""}`}
              loading="lazy"
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
        {/* Type badge + cancelled/attending status */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <TypeIcon className="h-3 w-3" />
            {typeLabel}
          </span>
          {isCancelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-destructive-foreground">
              <Ban className="h-3 w-3" />
              Cancelled
            </span>
          )}
          {!isCancelled && isAttending && !isWaitlisted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Attending
            </span>
          )}
          {!isCancelled && isAttending && isWaitlisted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <ClockIcon className="h-3 w-3" />
              Waitlisted{waitlistPosition > 0 ? ` #${waitlistPosition}` : ""}
            </span>
          )}
          {!isCancelled && isAttending && (event.ticket_fee ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              💰 Pay Offline
            </span>
          )}
          {event.capacity && (
            <span className={`ml-auto text-xs ${isFull ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {confirmedCount}/{event.capacity} spots
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-heading text-lg font-semibold text-card-foreground">
          {event.title}
        </h3>

        {/* Description */}
        {event.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Date & Time in local timezone */}
        <div className={`mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground ${isCancelled ? "line-through" : ""}`}>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(localDate, "EEE, MMM d")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {format(localDate, "h:mm a")}
          </span>
        </div>

        {/* Show private location/link only when attending & not cancelled */}
        {!isCancelled && isAttending && event.location && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-foreground inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              {event.location}
            </p>
            {event.address && (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 pl-5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {event.address.startsWith("http") ? (
                  <a
                    href={event.address}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    View on Maps <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  event.address
                )}
              </p>
            )}
          </div>
        )}
        {/* Cancelled: show location with strikethrough */}
        {isCancelled && isAttending && event.location && (
          <p className="mt-2 text-sm text-muted-foreground line-through inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {event.location}
          </p>
        )}
        {!isCancelled && isAttending && event.virtual_link && (
          <p className="mt-1 text-sm">
            🔗{" "}
            <a
              href={event.virtual_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Join Online
            </a>
          </p>
        )}
        {!isCancelled && isAttending && !event.virtual_link && event.zoom_link && (
          <p className="mt-1 text-sm">
            🔗{" "}
            <a
              href={event.zoom_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Join Zoom
            </a>
          </p>
        )}
        {/* Time-gated virtual join button for events with online_link */}
        {!isCancelled && onlineLink && canSeeJoinButton && (
          <div className="mt-2 space-y-1">
            <Button
              size="sm"
              variant={isLinkActive ? "default" : "outline"}
              disabled={!isLinkActive}
              className={`w-full gap-1.5 ${isLinkActive ? "animate-pulse-once" : ""}`}
              onClick={() => {
                if (isLinkActive && onlineLink) {
                  window.open(onlineLink, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <Video className="h-4 w-4" />
              Join Virtual Event
            </Button>
            {!isLinkActive && (
              <p className="text-xs text-muted-foreground text-center">
                ⏳ Activates in <span className="font-medium text-foreground">{countdownText}</span>
              </p>
            )}
          </div>
        )}

        {/* Not attending: show general location hint */}
        {!isCancelled && !isAttending && requiresLocation && event.location && (
          <p className="mt-1.5 text-sm text-muted-foreground italic">
            📍 Location revealed after RSVP
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-3 space-y-2">
          {isCancelled ? (
            <Button size="sm" variant="outline" disabled className="w-full gap-1.5 opacity-70">
              <Ban className="h-3.5 w-3.5" />
              Event Cancelled
            </Button>
          ) : (
            <>
              <div className="flex gap-2">
                {isAttending ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRsvpOpen(true)}
                      className="flex-1"
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Edit RSVP
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onShowTicket?.(event)}
                      className="flex-1"
                    >
                      <Ticket className="mr-1.5 h-3.5 w-3.5" />
                      View Ticket
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setRsvpOpen(true)}
                    className="w-full"
                    variant={isFull ? "outline" : "default"}
                  >
                    {isFull ? (
                      <>
                        <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                        Join Waitlist
                      </>
                    ) : (
                      "RSVP"
                    )}
                  </Button>
                )}
              </div>
              {isAttending && <AddToCalendarButton event={event} />}
            </>
          )}
        </div>
        </div>
      </div>

      {!isCancelled && (
        <RSVPModal event={event} open={rsvpOpen} onOpenChange={setRsvpOpen} />
      )}
    </>
  );
}
