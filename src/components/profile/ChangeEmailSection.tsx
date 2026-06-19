import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/runtime-client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface Props {
  currentEmail: string | undefined;
}

export default function ChangeEmailSection({ currentEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (email === currentEmail?.toLowerCase()) {
      toast.error("That's already your current email.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: window.location.origin },
    );
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Could not start email change.");
      return;
    }

    toast.success("Check your new inbox to confirm the change.", {
      description:
        "Your account, RSVPs and family stay exactly the same — only the sign-in email updates after you confirm.",
    });
    setOpen(false);
    setNewEmail("");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-card-foreground">
            Email Address
          </h3>
          <p className="text-sm text-muted-foreground break-all">{currentEmail}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Change
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change email address</DialogTitle>
            <DialogDescription>
              We'll send a confirmation link to your new address. Your account,
              RSVPs and family group stay the same — only the sign-in email
              changes after you click the link.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Current email</Label>
              <Input value={currentEmail ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">New email</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send confirmation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
