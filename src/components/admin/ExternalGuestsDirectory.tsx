import { useMemo, useState } from "react";
import { useAdminExternalGuests, useExternalGuestHistory } from "@/hooks/useExternalGuests";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookUser, Loader2, Search, Phone, Mail, CalendarDays, Download } from "lucide-react";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";

export default function ExternalGuestsDirectory() {
  const { data: guests = [], isLoading } = useAdminExternalGuests();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g: any) =>
      [g.name, g.email, g.phone, g.owner?.name, g.owner?.email]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [guests, debounced]);

  const totalInvited = guests.reduce((sum: number, g: any) => sum + (g.times_invited || 0), 0);
  const totalApproved = guests.reduce((sum: number, g: any) => sum + (g.times_approved || 0), 0);

  const exportCsv = () => {
    const header = ["Name", "Email", "Phone", "Saved by", "Saved by email", "Times invited", "Times approved", "Last invited"];
    const rows = filtered.map((g: any) => [
      g.name ?? "",
      g.email ?? "",
      g.phone ?? "",
      g.owner?.name ?? "",
      g.owner?.email ?? "",
      g.times_invited ?? 0,
      g.times_approved ?? 0,
      g.last_invited_at ? format(new Date(g.last_invited_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `external-guests-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookUser className="h-4 w-4 text-primary" />
          External Guests Directory
          <Badge variant="secondary" className="ml-auto text-xs">
            {guests.length} saved · {totalInvited} invites · {totalApproved} approvals
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by guest, member, phone or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5 h-9">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {search.trim() ? "No saved guests match your search." : "No external guests saved yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((g: any) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setOpenId(g.id)}
                className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      {g.email && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {g.email}</span>
                      )}
                      {g.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {g.phone}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Saved by <span className="font-medium text-foreground">{g.owner?.name || g.owner?.email || "—"}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <Badge variant="secondary" className="text-[10px]">{g.times_invited} invited</Badge>
                    <Badge variant="outline" className="text-[10px] block">{g.times_approved} approved</Badge>
                    {g.last_invited_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(g.last_invited_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <Sheet open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Guest history</SheetTitle>
          </SheetHeader>
          {openId && <GuestHistoryPanel guest={filtered.find((g: any) => g.id === openId) || guests.find((g: any) => g.id === openId)} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function GuestHistoryPanel({ guest }: { guest: any }) {
  const { data: history = [], isLoading } = useExternalGuestHistory(guest?.id ?? null);
  if (!guest) return null;
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border p-3">
        <p className="font-medium">{guest.name}</p>
        {guest.email && <p className="text-xs text-muted-foreground">{guest.email}</p>}
        {guest.phone && <p className="text-xs text-muted-foreground">{guest.phone}</p>}
        {guest.notes && (
          <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{guest.notes}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">{guest.times_invited} invited</Badge>
          <Badge variant="outline" className="text-xs">{guest.times_approved} approved</Badge>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Saved by {guest.owner?.name || guest.owner?.email || "—"}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Invitation history
        </h4>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No linked requests yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((r: any) => (
              <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{r.event?.title ?? "(deleted event)"}</p>
                  <Badge
                    variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                    className="text-[10px] capitalize"
                  >
                    {r.status}
                  </Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {r.event?.date_time ? format(new Date(r.event.date_time), "MMM d, yyyy") : format(new Date(r.created_at), "MMM d, yyyy")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
