import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserCheck, ChevronsUpDown, Loader2, Check, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface HostSelectorProps {
  hostId: string | null;
  onChange: (hostId: string | null) => void;
}

export default function HostSelector({ hostId, onChange }: HostSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const triggerLabel = selectedProfile
    ? selectedProfile.name || selectedProfile.email || "Selected host"
    : "Select host…";

  return (
    <div>
      <Label className="flex items-center gap-1.5 mb-1.5 text-sm font-medium">
        <UserCheck className="h-3.5 w-3.5 text-primary" />
        Event Host
      </Label>

      <div className="flex gap-1.5">
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "flex-1 justify-between font-normal h-10 min-w-0",
                !selectedProfile && "text-muted-foreground"
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 z-[90]"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-2">
              <Input
                placeholder="Search by name or email (min 2)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
                autoFocus
              />
            </div>

            <div className="max-h-56 overflow-y-auto">
              {debouncedSearch.trim().length < 2 ? (
                <p className="px-3 py-3 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              ) : isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : !searchResults?.length ? (
                <p className="px-3 py-3 text-center text-sm text-muted-foreground">No users found</p>
              ) : (
                searchResults.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer",
                      hostId === p.id && "bg-accent"
                    )}
                    onClick={() => {
                      onChange(p.id);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        hostId === p.id ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.name || p.email}</p>
                      {p.email && p.name && (
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      )}
                      {p.family_name && (
                        <p className="text-xs text-muted-foreground truncate">{p.family_name}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {hostId && (
              <button
                type="button"
                className="w-full border-t px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors text-left"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear selection
              </button>
            )}
          </PopoverContent>
        </Popover>

        {hostId && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => onChange(null)}
            aria-label="Remove host"
            title="Remove host"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        Optional — the host can see the guest list and potluck details
      </p>
    </div>
  );
}
