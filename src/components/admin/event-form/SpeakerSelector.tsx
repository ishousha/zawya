import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SpeakerSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function SpeakerSelector({ selectedIds, onChange }: SpeakerSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: speakers } = useQuery({
    queryKey: ["speakers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedSpeakers = useMemo(
    () => (speakers ?? []).filter((s) => selectedIds.includes(s.id)),
    [speakers, selectedIds]
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (!speakers || speakers.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Mic className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Featured Special Guests</h3>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 font-normal"
          >
            <span className="text-sm text-muted-foreground">
              {selectedIds.length === 0
                ? "Select special guests…"
                : `${selectedIds.length} special guest${selectedIds.length > 1 ? "s" : ""} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[90]" align="start">
          <Command>
            <CommandInput placeholder="Search special guests…" />
            <CommandList>
              <CommandEmpty>No special guests found.</CommandEmpty>
              <CommandGroup>
                {speakers.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.name}
                    onSelect={() => toggle(s.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.includes(s.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedSpeakers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedSpeakers.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.name}
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Select one or more special guests for this event
      </p>
    </div>
  );
}
