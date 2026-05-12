import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/runtime-client";
import { toast } from "sonner";

interface EventBroadcastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

export default function EventBroadcastModal({ open, onOpenChange, eventId, eventTitle }: EventBroadcastModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both the subject and message");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-broadcast", {
        body: { event_id: eventId, subject: subject.trim(), message: message.trim() },
      });

      if (error) throw error;

      const sent = data?.sent ?? 0;
      if (sent === 0) {
        toast.info("No attendees to notify for this event");
      } else {
        toast.success(`Broadcast sent to ${sent} attendee${sent > 1 ? "s" : ""}`);
      }
      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (err) {
      console.error("Broadcast failed:", err);
      toast.error("Failed to send broadcast. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Email Attendees</DialogTitle>
          <DialogDescription>
            Send a message to all confirmed attendees of <strong>{eventTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="broadcast-subject">Subject Line</Label>
            <Input
              id="broadcast-subject"
              placeholder="e.g. Venue Change — Friday Gathering"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea
              id="broadcast-message"
              placeholder="Type your message to attendees..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={sending}
              className="resize-y"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="w-full gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Broadcast
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
