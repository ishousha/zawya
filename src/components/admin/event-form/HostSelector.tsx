import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCheck, ChevronsUpDown, Loader2, Check, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

type HostProfile = {
  id: string;
  name: string | null;
  email: string | null;
  family_name: string | null;
};

interface HostSelectorProps {
  hostId: string | null;
  onChange: (hostId: string | null) => void;
}

export default function HostSelector({ hostId, onChange }: HostSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 350);
  const debouncedTerm = debouncedSearch.trim();
  const isDebouncing = open && search.trim() !== debouncedTerm;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const { data: searchResults = [], isFetching } = useQuery<HostProfile[]>({
    queryKey: ["host-search", debouncedTerm],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const term = debouncedTerm.replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim();
      let query = supabase
        .from("profiles")
        .select("id, name, email, family_name")
        .order("name")
        .limit(50);
      if (term.length >= 1) {
        const q = `%${term}%`;
        query = query.or(`name.ilike.${q},email.ilike.${q},family_name.ilike.${q}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as HostProfile[];
    },
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedTerm, searchResults.length]);

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

  const selectHost = (id: string) => {
    onChange(id);
    setSearch("");
    setOpen(false);
  };

  return (
    <div>
      <Label className="flex items-center gap-1.5 mb-1.5 text-sm font-medium">
        <UserCheck className="h-3.5 w-3.5 text-primary" />
        Event Host
      </Label>

      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1" ref={rootRef}>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-controls="host-selector-results"
              onClick={() => setOpen((prev) => !prev)}
              className={cn(
                "w-full justify-between font-normal h-10 min-w-0",
                !selectedProfile && "text-muted-foreground"
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

          {open && (
            <div
              id="host-selector-results"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-[100] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
            >
            <div className="p-2">
              <Input
                ref={inputRef}
                placeholder="Search by name, email, or family…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((prev) => Math.min(prev + 1, Math.max(searchResults.length - 1, 0)));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (e.key === "Enter" && searchResults[activeIndex]) {
                    e.preventDefault();
                    selectHost(searchResults[activeIndex].id);
                  }
                }}
              />
            </div>

            <div className="max-h-56 overflow-y-auto">
              {isFetching || isDebouncing ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : !searchResults.length ? (
                <p className="px-3 py-3 text-center text-sm text-muted-foreground">No users found</p>
              ) : (
                searchResults.map((p, index) => (
                  <button
                    type="button"
                    key={p.id}
                    role="option"
                    aria-selected={hostId === p.id}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                      (hostId === p.id || activeIndex === index) && "bg-accent"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectHost(p.id);
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
                  </button>
                ))
              )}
            </div>

            {hostId && (
              <button
                type="button"
                className="w-full border-t px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors text-left"
                onClick={() => {
                  onChange(null);
                  setSearch("");
                  setOpen(false);
                }}
              >
                Clear selection
              </button>
            )}
            </div>
          )}
        </div>

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
