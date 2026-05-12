import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Mail, Clock } from "lucide-react";

type Status = "ok" | "warn" | "missing" | "unknown";

interface DomainResult {
  domain: string;
  spf: { status: Status; value: string | null; note: string };
  dmarc: { status: Status; value: string | null; policy?: string; note: string };
  dkim: { status: Status; selectors: { selector: string; value: string }[]; note: string };
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

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-deliverability", { body: {} });
      if (error) throw error;
      return data as CheckResult;
    },
    onSuccess: (d) => setResult(d),
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
