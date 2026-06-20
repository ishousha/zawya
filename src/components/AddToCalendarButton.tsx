import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

function toUTCString(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleCalendarUrl(event: Event): string {
  const start = new Date(event.date_time);
  const end = event.end_date_time
    ? new Date(event.end_date_time)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2h

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUTCString(start)}/${toUTCString(end)}`,
  });

  const location = [event.location, event.address].filter(Boolean).join(", ");
  if (location) params.set("location", location);

  const details: string[] = [];
  if (event.description) details.push(event.description);
  // Virtual links intentionally omitted — gated behind RSVP + 15-min rule on EventCard
  if (details.length) params.set("details", details.join("\n\n"));

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcsContent(event: Event): string {
  const start = new Date(event.date_time);
  const end = event.end_date_time
    ? new Date(event.end_date_time)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const location = [event.location, event.address].filter(Boolean).join(", ");
  const description: string[] = [];
  if (event.description) description.push(event.description);

  const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zawya//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${toUTCString(start)}`,
    `DTEND:${toUTCString(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];

  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  if (description.length) lines.push(`DESCRIPTION:${escapeIcs(description.join("\\n\\n"))}`);
  lines.push(`UID:${event.id}@zawya`, "END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

function downloadIcs(event: Event) {
  const content = buildIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AddToCalendarButton({ event }: { event: Event }) {
  const isMobile = useIsMobile();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
          <CalendarPlus className="h-3.5 w-3.5" />
          Add to Calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isMobile ? "top" : "bottom"}
        collisionPadding={16}
      >
        <DropdownMenuItem
          onClick={() => window.open(buildGoogleCalendarUrl(event), "_blank")}
        >
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadIcs(event)}>
          Apple / Outlook (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
