import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Mail, Clock, Copy, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Status = "ok" | "warn" | "missing" | "unknown";

interface DomainResult {
  domain: string;
  spf: { status: Status; value: string | null; note: string };
  dmarc: { status: Status; value: string | null; policy?: string | null; note: string };
  dkim: { status: Status; selectors: { selector: string; value: string }[]; note: string };
}

interface Recommendation {
  ready_to_tighten: boolean;
  current_policy: string | null;
  consecutive_ok: number;
  days_stable: number;
  required_consecutive: number;
  required_days: number;
  suggested_record: string;
  reason: string;
}

interface CheckResult {
  checkedAt: string;
  sender: DomainResult;
  root: DomainResult;
  alignment: {
    from_domain: string;
    spf_aligned: boolean;
    dkim_aligned: boolean;
    dmarc_present_org: boolean;
    note: string;
  };
  recommendation?: Recommendation;
}

const ROOT_SPF_RECORD = "v=spf1 -all";

function CopyButton({ value, label }: { value: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast({ title: "Copied", description: label ?? "Record copied to clipboard." });
      }}
    >
      <Copy className="h-3 w-3" /> Copy
    </Button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
    ok: { label: "OK", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: ShieldCheck },
    warn: { label: "Warning", cls: "bg-amber-100 text-amber-800 border-amber-200", Icon: ShieldAlert },
    missing: { label: "Missing", cls: "bg-red-100 text-red-800 border-red-200", Icon: ShieldX },
    unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground border-border", Icon: ShieldAlert },
  };
  const { label, cls, Icon } = map[status];
  return (
    <Badge variant="outline" className={`gap-1 ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

function DomainCard({ d }: { d: DomainResult }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h4 className="font-heading text-base font-semibold">{d.domain}</h4>
      <div className="space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">SPF</div>
            <p className="text-xs text-muted-foreground">{d.spf.note}</p>
            {d.spf.value && <code className="mt-1 block break-all rounded bg-muted/50 p-1.5 text-xs">{d.spf.value}</code>}
          </div>
          <StatusBadge status={d.spf.status} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">DKIM</div>
            <p className="text-xs text-muted-foreground">{d.dkim.note}</p>
            {d.dkim.selectors.length > 0 && (
              <ul className="mt-1 space-y-1">
                {d.dkim.selectors.map((s) => (
                  <li key={s.selector} className="text-xs">
                    <span className="font-mono">{s.selector}</span>: <span className="text-muted-foreground break-all">{s.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <StatusBadge status={d.dkim.status} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">DMARC</div>
            <p className="text-xs text-muted-foreground">{d.dmarc.note}</p>
            {d.dmarc.value && <code className="mt-1 block break-all rounded bg-muted/50 p-1.5 text-xs">{d.dmarc.value}</code>}
          </div>
          <StatusBadge status={d.dmarc.status} />
        </div>
      </div>
    </div>
  );
}

export default function DeliverabilityCheck() {
  const [result, setResult] = useState<CheckResult | null>(null);

  const history = useQuery({
    queryKey: ["deliverability-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliverability_checks")
        .select("checked_at, dmarc_org_present, source")
        .order("checked_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lastAuto = history.data?.[0];
  const dmarcDetected = !!lastAuto?.dmarc_org_present;

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-deliverability", { body: { persist: true, source: "manual" } });
      if (error) throw error;
      return data as CheckResult;
    },
    onSuccess: (d) => { setResult(d); history.refetch(); },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email Deliverability Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Verify SPF, DKIM, and DMARC for <code>notify.zawya.app</code> (sender) and <code>zawya.app</code> (organizational domain).
          Helps diagnose Hotmail/Outlook delays.
        </p>
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs flex items-start gap-2">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="space-y-1">
            <div className="font-medium">
              Auto-check: {dmarcDetected
                ? "stopped (org DMARC detected ✓)"
                : "every 24h at 03:00 UTC until DMARC is detected for zawya.app"}
            </div>
            {lastAuto && (
              <div className="text-muted-foreground">
                Last automated check: {new Date(lastAuto.checked_at).toLocaleString()} ({lastAuto.source})
              </div>
            )}
            {!lastAuto && !history.isLoading && (
              <div className="text-muted-foreground">No automated checks recorded yet.</div>
            )}
          </div>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {result ? "Re-check now" : "Run check"}
        </Button>
        {run.error && (
          <p className="text-sm text-destructive">{(run.error as Error).message}</p>
        )}
        {result && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DomainCard d={result.sender} />
              <DomainCard d={result.root} />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
              <div className="font-medium">Alignment summary</div>
              <ul className="space-y-1 text-xs">
                <li>From domain: <code>{result.alignment.from_domain}</code></li>
                <li>SPF aligned: <StatusBadge status={result.alignment.spf_aligned ? "ok" : "warn"} /></li>
                <li>DKIM aligned: <StatusBadge status={result.alignment.dkim_aligned ? "ok" : "unknown"} /></li>
                <li>Org DMARC present: <StatusBadge status={result.alignment.dmarc_present_org ? "ok" : "missing"} /></li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">{result.alignment.note}</p>
              <p className="text-[11px] text-muted-foreground">Checked at {new Date(result.checkedAt).toLocaleString()}</p>
            </div>

            {/* Root SPF setup instructions — only shown when missing */}
            {result.root.spf.status === "missing" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
                <div className="font-medium flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-700" />
                  Add root SPF for <code>zawya.app</code>
                </div>
                <p className="text-xs text-amber-900/80">
                  Tells receivers that nothing legitimate sends from the bare domain — extra anti-spoofing protection.
                  Add this TXT record at your domain registrar (host: <code>@</code>):
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-background/70 p-1.5 text-xs">{ROOT_SPF_RECORD}</code>
                  <CopyButton value={ROOT_SPF_RECORD} label="SPF record copied." />
                </div>
                <p className="text-[11px] text-amber-900/70">
                  This warning will clear automatically on the next check after the record propagates.
                </p>
              </div>
            )}

            {/* DMARC tightening recommendation */}
            {result.recommendation && result.recommendation.current_policy === "none" && (
              <div className={`rounded-lg border p-4 text-sm space-y-2 ${
                result.recommendation.ready_to_tighten
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-border bg-muted/30"
              }`}>
                <div className="font-medium flex items-center gap-2">
                  {result.recommendation.ready_to_tighten ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  {result.recommendation.ready_to_tighten
                    ? "Ready to tighten DMARC to p=quarantine"
                    : "DMARC tightening — monitoring stability"}
                </div>
                <p className="text-xs text-muted-foreground">{result.recommendation.reason}</p>
                <div className="text-xs">
                  Stability: <strong>{result.recommendation.consecutive_ok}</strong>/{result.recommendation.required_consecutive} clean checks ·{" "}
                  <strong>{result.recommendation.days_stable}</strong>/{result.recommendation.required_days} days
                </div>
                {result.recommendation.ready_to_tighten && (
                  <>
                    <p className="text-xs">
                      Replace your <code>_dmarc.zawya.app</code> TXT record at your registrar with:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-background/70 p-1.5 text-xs">
                        {result.recommendation.suggested_record}
                      </code>
                      <CopyButton value={result.recommendation.suggested_record} label="DMARC record copied." />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      After updating, run a re-check. The system will detect <code>p=quarantine</code> and stop monitoring.
                    </p>
                  </>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">Checked at {new Date(result.checkedAt).toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  );
}
