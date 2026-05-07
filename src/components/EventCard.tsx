import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { format } from "date-fns";
import { MapPin, Video, Users, Calendar, Clock, CheckCircle2, Ticket, Edit, Building2, ExternalLink, Ban, BookOpen, Mountain, Handshake, ClockIcon, ScanLine, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP, useEventRsvpCounts } from "@/hooks/useRSVP";
import { useEventTypes, getEventTypeIcon } from "@/hooks/useEventTypes";
import RSVPModal from "@/components/RSVPModal";
import SelfCheckinModal from "@/components/SelfCheckinModal";
import AddToCalendarButton from "@/components/AddToCalendarButton";
import PotluckMenu from "@/components/PotluckMenu";
import { useNeedsReclaim } from "@/hooks/useReclaimPotluck";
import { AlertTriangle } from "lucide-react";
import SpeakerBadge from "@/components/SpeakerBadge";
import LazyImage from "@/components/LazyImage";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface EventCardProps {
  event: Event;
  onShowTicket?: (event: Event) => void;
  isPast?: boolean;
}

function EventCardInner({ event, onShowTicket, isPast = false }: EventCardProps) {
  const localDate = new Date(event.date_time);
  const { data: eventTypes } = useEventTypes();
  const eventType = eventTypes?.find((t) => t.id === event.event_type_id);
  const TypeIcon = eventType ? getEventTypeIcon(eventType.icon) : MapPin;
  const typeLabel = eventType?.name ?? "Event";

  const { data: myRSVP } = useMyRSVP(event.id);
  const { data: counts } = useEventRsvpCounts(event.id);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const checkClamped = useCallback(() => {
    const el = descRef.current;
    if (el) setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    checkClamped();
  }, [event.description, checkClamped]);
  const { profile } = useAuth();

  const isAttending = !!myRSVP && myRSVP.status !== "cancelled";
  const isWaitlisted = myRSVP?.status === "waitlisted";
  const isCancelled = event.status === "cancelled";

  const confirmedCount = counts?.attending_count ?? 0;
  const checkedInCount = counts?.checked_in_count ?? 0;
  const waitlistedCount = counts?.waitlisted_count ?? 0;
  const isFull = !!event.capacity && confirmedCount >= event.capacity;

  // Modality flags
  const isPhysical = !!event.location && !event.location.match(/^https?:\/\//i);
  const onlineLink = event.online_link || event.virtual_link || event.zoom_link || null;
  const isVirtual = !!onlineLink || event.is_hybrid || !(eventType?.requires_location ?? true);
  const eventTime = new Date(event.date_time).getTime();

  // Live Now detection
  const endTime = event.end_date_time ? new Date(event.end_date_time).getTime() : eventTime + 4 * 60 * 60 * 1000;
  const isLiveNow = !isPast && now.getTime() >= eventTime && now.getTime() < endTime;
  const linkActivatesAt = eventTime - 15 * 60 * 1000;
  const isLinkActive = now.getTime() >= linkActivatesAt;
  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";

  // Gender restriction
  const audienceGender = (event as any).audience_gender as string | undefined;
  const userGender = (profile as any)?.gender as string | undefined;
  const genderBlock: null | { label: string; helper: string } = (() => {
    if (isAdminOrMod) return null;
    if (!audienceGender || audienceGender === "Everyone") return null;
    if (audienceGender === "Brothers Only" && userGender !== "male") {
      return {
        label: "Brothers Only",
        helper: !userGender
          ? "Add your gender in your profile to RSVP."
          : "This gathering is for brothers only.",
      };
    }
    if (audienceGender === "Sisters Only" && userGender !== "female") {
      return {
        label: "Sisters Only",
        helper: !userGender
          ? "Add your gender in your profile to RSVP."
          : "This gathering is for sisters only.",
      };
    }
    return null;
  })();


  // Self check-in: active within 2 hours of event start
  const checkinActivatesAt = eventTime - 2 * 60 * 60 * 1000;
  const isCheckinActive = now.getTime() >= checkinActivatesAt;
  const isCheckedIn = myRSVP?.checked_in ?? false;
  const canSelfCheckin = isAttending && !isWaitlisted && !isCheckedIn && !isCancelled;

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
    if (!isVirtual || isLinkActive) return;
    const interval = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(interval);
  }, [isVirtual, isLinkActive]);

  // Waitlist position not available without full row access; fall back to total waitlisted count
  const waitlistPosition = useMemo(() => {
    if (!isWaitlisted) return 0;
    return waitlistedCount;
  }, [isWaitlisted, waitlistedCount]);

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
            <LazyImage
              src={event.cover_photo_url}
              alt={event.title}
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
        {/* Type badge + cancelled/attending status */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <TypeIcon className="h-3 w-3" />
            {typeLabel}
          </span>
          {event.online_link && !isCancelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary)/0.15)] px-2.5 py-0.5 text-xs font-medium text-primary">
              <Video className="h-3 w-3" />
              {requiresLocation ? "Hybrid" : "Virtual"}
            </span>
          )}
          {(event as any).mureeds_only && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
              🔒 Private
            </span>
          )}
          {(event as any).audience_gender === "Brothers Only" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
              ♂ Brothers Only
            </span>
          )}
          {(event as any).audience_gender === "Sisters Only" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-semibold text-pink-700 dark:text-pink-300">
              ♀ Sisters Only
            </span>
          )}
          {isLiveNow && !isCancelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-foreground opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-foreground" />
              </span>
              Live Now
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-destructive-foreground">
              <Ban className="h-3 w-3" />
              Cancelled
            </span>
          )}
          {!isCancelled && isAttending && !isWaitlisted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              <CheckCircle2 className="h-3 w-3" />
              {isPhysical && isCheckedIn ? "Checked In" : "Attending"}
            </span>
          )}
          {!isCancelled && isAttending && isWaitlisted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <ClockIcon className="h-3 w-3" />
              Waitlisted{waitlistPosition > 0 ? ` #${waitlistPosition}` : ""}
            </span>
          )}
          {!isCancelled && (event.ticket_fee ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-foreground">
              💰 Fee: ${Number(event.ticket_fee).toFixed(0)}
            </span>
          )}
          {!isCancelled && (event as any).age_group && (event as any).age_group !== "All Ages" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(250,60%,95%)] px-2.5 py-0.5 text-xs font-medium text-[hsl(250,40%,35%)]">
              👥 {(event as any).age_group}
            </span>
          )}
          {isPhysical && checkedInCount > 0 && isAttending && (
            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
              <CheckCircle2 className="h-3 w-3" />
              {checkedInCount} arrived
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
          <>
            <p
              ref={descRef}
              className={`mt-1 text-sm text-muted-foreground whitespace-pre-line ${!isExpanded ? "line-clamp-3" : ""}`}
            >
              {event.description}
            </p>
            {(isClamped || isExpanded) && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="mt-0.5 text-sm font-medium text-primary hover:underline"
              >
                {isExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </>
        )}

        {/* Date & Time in local timezone */}
        <div className={`mt-2 flex flex-wrap items-center gap-3 text-sm ${isCancelled ? "line-through text-muted-foreground" : isLiveNow ? "text-accent-foreground font-medium" : "text-muted-foreground"}`}>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(localDate, "EEE, MMM d")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {format(localDate, "h:mm a")}
          </span>
        </div>

        {/* Speaker Badge */}
        <SpeakerBadge eventId={event.id} />
        {!isCancelled && isAttending && event.location && (() => {
          const addr = event.address ?? "";
          const customMapsUrl = (event as any).maps_url as string | null;
          const isUrl = addr.startsWith("http");
          const mapsHref = customMapsUrl
            ? customMapsUrl
            : isUrl
              ? addr
              : addr
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                : null;
          const hint = (event as any).location_hint as string | null;

          const Inner = (
            <>
              <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                {event.location}
              </p>
              {addr && (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 pl-5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="inline-flex items-center gap-1">
                    {isUrl ? "View on Maps" : addr}
                    {mapsHref && <ExternalLink className="h-3 w-3" />}
                  </span>
                </p>
              )}
            </>
          );

          return (
            <div className="mt-2 space-y-1">
              {mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block space-y-1 -mx-1 px-1 py-0.5 rounded hover:bg-accent/40 transition-colors"
                  aria-label={`Open ${event.location} in maps`}
                >
                  {Inner}
                </a>
              ) : (
                <div className="space-y-1">{Inner}</div>
              )}
              {hint && (
                <p className="text-sm text-muted-foreground italic pl-5">
                  {hint}
                </p>
              )}
            </div>
          );
        })()}
        {/* Cancelled: show location with strikethrough */}
        {isCancelled && isAttending && event.location && (
          <p className="mt-2 text-sm text-muted-foreground line-through inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {event.location}
          </p>
        )}
        {/* Zoom Lockbox — 3-state virtual meeting section */}
        {!isPast && !isCancelled && isVirtual && (() => {
          const hasRsvpd = isAttending && !isWaitlisted;

          // State 1: Not RSVP'd — show locked message only
          if (!hasRsvpd) {
            return (
              <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground text-center">
                  🔒 RSVP to unlock the virtual meeting link.
                </p>
              </div>
            );
          }

          // State 3: RSVP'd + within 15 min (or live) + link exists
          if (isLinkActive && onlineLink) {
            return (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                {event.zoom_password && (
                  <p className="text-sm font-medium text-foreground text-center">
                    🔑 Zoom Passcode: <span className="font-bold tracking-wide">{event.zoom_password}</span>
                  </p>
                )}
                <Button
                  size="sm"
                  variant="default"
                  className="w-full gap-1.5"
                  onClick={() => window.open(onlineLink, "_blank", "noopener,noreferrer")}
                >
                  <Video className="h-4 w-4" />
                  Join Virtual Event
                </Button>
              </div>
            );
          }

          // State 2: RSVP'd but > 15 min before start OR no link yet
          return (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
              <p className="text-sm text-muted-foreground text-center">
                🗓️ You're going! The virtual meeting link will unlock 15 minutes before the event starts.
              </p>
              {countdownText && (
                <p className="text-xs text-muted-foreground text-center">
                  ⏳ Unlocks in <span className="font-medium text-foreground">{countdownText}</span>
                </p>
              )}
            </div>
          );
        })()}

        {/* Not attending: show ONLY the location hint (no name, no address) */}
        {!isPast && !isCancelled && !isAttending && requiresLocation && (event as any).location_hint && (
          <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span>
              {(event as any).location_hint}{" "}
              <span className="italic text-xs">(Exact location revealed after RSVP)</span>
            </span>
          </div>
        )}
        {/* Not attending + no hint set: minimal "revealed after RSVP" notice */}
        {!isPast && !isCancelled && !isAttending && requiresLocation && !(event as any).location_hint && event.location && (
          <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="italic">Location revealed after RSVP</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 space-y-2">
          {isPast ? (
            <>
              {(event as any).recording_url ? (
                <div className="space-y-1.5">
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => window.open((event as any).recording_url, "_blank", "noopener,noreferrer")}
                  >
                    <Play className="h-3.5 w-3.5" />
                    ▶ Watch Recording
                  </Button>
                  {(event as any).recording_passcode && (
                    <p className="text-xs text-muted-foreground text-center">
                      🔑 Passcode: <span className="font-medium text-foreground">{(event as any).recording_passcode}</span>
                    </p>
                  )}
                </div>
              ) : isVirtual ? (
                <p className="text-sm text-muted-foreground text-center py-2 italic">
                  Event Ended. Recording coming soon.
                </p>
              ) : (
                <Button size="sm" variant="outline" className="w-full gap-1.5" disabled>
                  <Calendar className="h-3.5 w-3.5" />
                  Past Event
                </Button>
              )}
            </>
          ) : isCancelled ? (
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
                  isFull && event.waitlist_capacity <= 0 ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant="secondary"
                      disabled
                    >
                      Event Full
                    </Button>
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
                  )
                )}
              </div>
              {isPhysical && isCheckedIn && (
                <Button
                  size="sm"
                  variant="default"
                  disabled
                  className="w-full gap-1.5 bg-primary hover:bg-primary text-primary-foreground border-primary cursor-default opacity-100"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  ✓ Checked In
                </Button>
              )}
              {isPhysical && canSelfCheckin && (
                <Button
                  size="sm"
                  variant={isCheckinActive ? "default" : "outline"}
                  disabled={!isCheckinActive}
                  onClick={() => setCheckinOpen(true)}
                  className="w-full gap-1.5"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  {isCheckinActive ? "Check In Now" : "Check-in opens 2hrs before event"}
                </Button>
              )}
              {isAttending && <AddToCalendarButton event={event} />}
            </>
          )}
        </div>

        {/* Potluck reclaim notice — shows when this user's potluck claims were wiped */}
        {!isPast && !isCancelled && event.has_potluck && isAttending && (
          <ReclaimNotice eventId={event.id} hasPotluck={event.has_potluck} onReclaim={() => setRsvpOpen(true)} />
        )}

        {/* Potluck Menu — anonymous dish list */}
        {!isPast && !isCancelled && event.has_potluck && (
          <PotluckMenu eventId={event.id} />
        )}
        </div>
      </div>

      {!isCancelled && (
        <RSVPModal event={event} open={rsvpOpen} onOpenChange={setRsvpOpen} />
      )}

      {canSelfCheckin && myRSVP && (
        <SelfCheckinModal
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          eventId={event.id}
          rsvpId={myRSVP.id}
          eventTitle={event.title}
        />
      )}
    </>
  );
}

function ReclaimNotice({
  eventId,
  hasPotluck,
  onReclaim,
}: {
  eventId: string;
  hasPotluck: boolean | null | undefined;
  onReclaim: () => void;
}) {
  const { data: needsReclaim } = useNeedsReclaim(eventId, hasPotluck);
  if (!needsReclaim) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Re-select your potluck items</p>
          <p className="mt-0.5 text-xs leading-relaxed">
            Due to a recent fix, your potluck selections were cleared. Please pick them again so the host knows what you're bringing.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-8 border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
            onClick={onReclaim}
          >
            Reclaim potluck
          </Button>
        </div>
      </div>
    </div>
  );
}

const EventCard = memo(EventCardInner);
export default EventCard;
