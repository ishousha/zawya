import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2, PartyPopper } from "lucide-react";

interface SelfCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  rsvpId: string;
  eventTitle: string;
  /** If provided, auto-validate this PIN on mount (QR magic link flow) */
  autoPin?: string;
}

export default function SelfCheckinModal({
  open,
  onOpenChange,
  eventId,
  rsvpId,
  eventTitle,
  autoPin,
}: SelfCheckinModalProps) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const doCheckin = useCallback(async (enteredPin: string) => {
    setChecking(true);
    setError("");

    try {
      // Validate PIN server-side (never exposes real PIN to client)
      const { data: pinValid, error: pinErr } = await supabase
        .rpc("verify_checkin_pin", { _event_id: eventId, _pin: enteredPin });

      if (pinErr) {
        setError("Could not verify PIN. Please try again.");
        setChecking(false);
        return;
      }

      if (!pinValid) {
        setError("Incorrect PIN. Please check the poster and try again.");
        setPin("");
        setChecking(false);
        return;
      }

      // PIN matches — mark as checked in
      const { error: updateErr } = await supabase
        .from("rsvps")
        .update({ checked_in: true })
        .eq("id", rsvpId);

      if (updateErr) {
        setError("Failed to check in. Please try again.");
        setChecking(false);
        return;
      }

      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["my-rsvp"] });
      queryClient.invalidateQueries({ queryKey: ["rsvps"] });
      toast.success("You're checked in! 🎉");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  }, [eventId, rsvpId, queryClient]);

  // Auto-validate PIN from QR deep link
  useEffect(() => {
    if (open && autoPin && autoPin.length === 4 && !success) {
      setPin(autoPin);
      doCheckin(autoPin);
    }
  }, [open, autoPin, success, doCheckin]);

  // When PIN is complete (4 digits), auto-submit
  useEffect(() => {
    if (pin.length === 4 && !autoPin && !checking && !success) {
      doCheckin(pin);
    }
  }, [pin, autoPin, checking, success, doCheckin]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPin("");
      setError("");
      setSuccess(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-center">
            {success ? "You're In!" : "Self Check-In"}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative">
              <CheckCircle2 className="h-16 w-16 text-primary animate-bounce" />
              <PartyPopper className="h-8 w-8 text-accent-foreground absolute -top-2 -right-2 animate-ping" />
            </div>
            <p className="text-lg font-semibold text-foreground text-center">
              Welcome to {eventTitle}!
            </p>
            <p className="text-sm text-muted-foreground text-center">
              You've been checked in successfully.
            </p>
            <Button onClick={() => onOpenChange(false)} className="w-full mt-2">
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter the 4-digit PIN displayed at the venue to check in.
            </p>

            <InputOTP
              maxLength={4}
              value={pin}
              onChange={setPin}
              disabled={checking}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-14 w-14 text-2xl font-mono" />
                <InputOTPSlot index={1} className="h-14 w-14 text-2xl font-mono" />
                <InputOTPSlot index={2} className="h-14 w-14 text-2xl font-mono" />
                <InputOTPSlot index={3} className="h-14 w-14 text-2xl font-mono" />
              </InputOTPGroup>
            </InputOTP>

            {checking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center font-medium">
                {error}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
