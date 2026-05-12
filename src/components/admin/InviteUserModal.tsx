import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { email: email.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Invitation sent! They'll receive an email to join.");
      setEmail("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send invitation"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invite User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Send an email invitation. The recipient will receive a magic link to create their account.
          </p>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address *</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <Button
            className="w-full"
            disabled={!email.trim() || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
