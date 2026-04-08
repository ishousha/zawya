import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic } from "lucide-react";

interface SpeakerSelectorProps {
  speakerId: string | null;
  onChange: (id: string | null) => void;
}

export default function SpeakerSelector({ speakerId, onChange }: SpeakerSelectorProps) {
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Mic className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Featured Speaker</h3>
      </div>
      <Select
        value={speakerId ?? "none"}
        onValueChange={(v) => onChange(v === "none" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a speaker (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No speaker</SelectItem>
          {speakers?.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">
        Optionally feature a guest speaker or Sheikh for this event
      </p>
    </div>
  );
}
