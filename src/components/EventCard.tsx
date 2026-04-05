import { useState } from "react";
import { format } from "date-fns";
import { MapPin, Video, Users, Calendar, Clock, CheckCircle2, Ticket, Edit, Building2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyRSVP } from "@/hooks/useRSVP";
import RSVPModal from "@/components/RSVPModal";
import AddToCalendarButton from "@/components/AddToCalendarButton";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

const typeConfig = {
  physical: { icon: MapPin, label: "In Person" },
  online: { icon: Video, label: "Online" },
  kids: { icon: Users, label: "Kids" },
} as const;

interface EventCardProps {
  event: Event;
  onShowTicket?: (event: Event) => void;
}

export default function EventCard({ event, onShowTicket }: EventCardProps) {
  const localDate = new Date(event.date_time);
  const TypeIcon = typeConfig[event.type].icon;
  const { data: myRSVP } = useMyRSVP(event.id);
  const [rsvpOpen, setRsvpOpen] = useState(false);

  const isAttending = !!myRSVP;

  return (
    <>
      <div className={`animate-fade-in rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-md ${
        isAttending ? "border-primary/40" : "border-border"
      }`}>
        {/* Cover Photo */}
        {event.cover_photo_url && (
          <div className="relative w-full h-40">
            <img
              src={event.cover_photo_url}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="p-4">
        {/* Type badge + attending status */}
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <TypeIcon className="h-3 w-3" />
            {typeConfig[event.type].label}
          </span>
          {isAttending && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Attending
            </span>
          )}
          {event.capacity && (
            <span className="ml-auto text-xs text-muted-foreground">
              {event.capacity} spots
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

        {/* Show private location/link only when attending */}
        {isAttending && event.location && (
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
        {isAttending && event.virtual_link && (
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
        {isAttending && !event.virtual_link && event.zoom_link && (
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

        {/* Not attending: show general location hint */}
        {!isAttending && event.location && (
          <p className="mt-1.5 text-sm text-muted-foreground italic">
            📍 Location revealed after RSVP
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-3 space-y-2">
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
            >
              RSVP
            </Button>
          )}
        </div>
        </div>
      </div>

      <RSVPModal event={event} open={rsvpOpen} onOpenChange={setRsvpOpen} />
    </>
  );
}
