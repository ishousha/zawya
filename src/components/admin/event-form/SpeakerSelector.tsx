import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mic } from "lucide-react";

interface SpeakerSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function SpeakerSelector({ selectedIds, onChange }: SpeakerSelectorProps) {
  const { data: speakers } = useQuery({
    queryKey: ["speakers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

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
        <h3 className="text-sm font-semibold text-foreground">Featured Speakers</h3>
      </div>
      <div className="space-y-2 rounded-lg border border-border p-3">
        {speakers.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-3 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              checked={selectedIds.includes(s.id)}
              onCheckedChange={() => toggle(s.id)}
            />
            <span className="text-sm text-foreground">{s.name}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Select one or more guest speakers for this event
      </p>
    </div>
  );
}
