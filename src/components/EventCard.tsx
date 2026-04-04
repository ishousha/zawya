import { format } from "date-fns";
import { MapPin, Video, Users, Calendar, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

const typeConfig = {
  physical: { icon: MapPin, label: "In Person" },
  online: { icon: Video, label: "Online" },
  kids: { icon: Users, label: "Kids" },
} as const;

export default function EventCard({ event }: { event: Event }) {
  const localDate = new Date(event.date_time);
  const TypeIcon = typeConfig[event.type].icon;

  return (
    <div className="animate-fade-in rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
      {/* Type badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <TypeIcon className="h-3 w-3" />
          {typeConfig[event.type].label}
        </span>
        {event.capacity && (
          <span className="text-xs text-muted-foreground">
            {event.capacity} spots
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-heading text-lg font-semibold text-card-foreground">
        {event.title}
      </h3>

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

      {/* Location */}
      {event.location && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          📍 {event.location}
        </p>
      )}
    </div>
  );
}
