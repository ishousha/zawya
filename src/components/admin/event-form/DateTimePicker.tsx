import { useMemo } from "react";
import { format, parse, setHours, setMinutes } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Generate 15-minute interval time options */
function generateTimeOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${mm} ${ampm}`;
      options.push({ label, value });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

/**
 * Parses a "YYYY-MM-DDTHH:MM" datetime-local string into a Date,
 * or returns undefined if empty/invalid.
 */
function parseDTLocal(val: string): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

/** Format a Date back to "YYYY-MM-DDTHH:MM" */
function toDTLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

/** Snap minutes to nearest 15-min interval (floor) */
function snapTo15(minutes: number): number {
  return Math.floor(minutes / 15) * 15;
}

interface DateTimePickerProps {
  /** datetime-local format string: "YYYY-MM-DDTHH:MM" */
  value: string;
  onChange: (value: string) => void;
  /** Optional min datetime-local string for validation display */
  min?: string;
  className?: string;
  error?: boolean;
}

export default function DateTimePicker({
  value,
  onChange,
  className,
  error,
}: DateTimePickerProps) {
  const dateObj = parseDTLocal(value);

  const currentTime = useMemo(() => {
    if (!dateObj) return "19:00"; // default 7 PM
    const hh = String(dateObj.getHours()).padStart(2, "0");
    const mm = String(snapTo15(dateObj.getMinutes())).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [dateObj]);

  const handleDateSelect = (day: Date | undefined) => {
    if (!day) return;
    // Preserve existing time or default to 7 PM
    const hours = dateObj ? dateObj.getHours() : 19;
    const mins = dateObj ? snapTo15(dateObj.getMinutes()) : 0;
    const merged = setMinutes(setHours(day, hours), mins);
    onChange(toDTLocal(merged));
  };

  const handleTimeChange = (timeVal: string) => {
    const [hh, mm] = timeVal.split(":").map(Number);
    const base = dateObj ?? new Date();
    const merged = setMinutes(setHours(base, hh), mm);
    onChange(toDTLocal(merged));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Date popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 flex-1 justify-start text-left font-normal",
              !dateObj && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateObj ? format(dateObj, "EEE, MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleDateSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Time select */}
      <Select value={currentTime} onValueChange={handleTimeChange}>
        <SelectTrigger className={cn(
          "h-10 w-[120px] shrink-0",
          error && "border-destructive focus-visible:ring-destructive"
        )}>
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {TIME_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
