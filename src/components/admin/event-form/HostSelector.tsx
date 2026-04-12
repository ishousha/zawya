import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCheck, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface HostSelectorProps {
  hostId: string | null;
  onChange: (hostId: string | null) => void;
}

export default function HostSelector({ hostId, onChange }: HostSelectorProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["host-search", debouncedSearch],
    enabled: debouncedSearch.trim().length >= 2,
    queryFn: async () => {
      const q = `%${debouncedSearch.trim()}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, family_name")
        .or(`name.ilike.${q},email.ilike.${q},family_name.ilike.${q}`)
        .order("name")
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedProfile } = useQuery({
    queryKey: ["host-profile", hostId],
    enabled: !!hostId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, family_name")
        .eq("id", hostId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (hostId && selectedProfile) {
    return (
      <div>
        <Label className="block text-sm font-medium mb-1.5">Event Host</Label>
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {selectedProfile.name || selectedProfile.email}
            </p>
            {selectedProfile.email && selectedProfile.name && (
              <p className="text-xs text-muted-foreground truncate">{selectedProfile.email}</p>
            )}
            {selectedProfile.family_name && (
              <p className="text-xs text-muted-foreground">{selectedProfile.family_name}</p>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="block text-sm font-medium mb-1.5">Event Host</Label>
      <Input
        placeholder="Search by name or email (min 2 chars)..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="text-sm"
      />
      {open && debouncedSearch.trim().length >= 2 && (
        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : !searchResults?.length ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No users found</p>
          ) : (
            searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                onClick={() => {
                  onChange(p.id);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span className="font-medium text-foreground">{p.name || p.email}</span>
                {p.email && p.name && (
                  <span className="text-muted-foreground ml-1 text-xs">({p.email})</span>
                )}
                {p.family_name && (
                  <span className="text-muted-foreground ml-1">— {p.family_name}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Optional — the host can see the guest list and potluck details
      </p>
    </div>
  );
}
