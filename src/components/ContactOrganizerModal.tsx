import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/runtime-client";
import { toast } from "sonner";

interface ContactOrganizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

export default function ContactOrganizerModal({ open, onOpenChange, eventId, eventTitle }: ContactOrganizerModalProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please type a message");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("contact-organizer", {
        body: { event_id: eventId, message: message.trim() },
      });

      if (error) throw error;

      toast.success("Message sent! The organizers will reply to your email.");
      setMessage("");
      onOpenChange(false);
    } catch (err) {
      console.error("Contact organizer failed:", err);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Ask a Question about {eventTitle}</DialogTitle>
          <DialogDescription>
            Your message will be sent to the event organizers. They will reply directly to your email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="contact-message">Your Message</Label>
            <Textarea
              id="contact-message"
              placeholder="Type your question here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={sending}
              className="resize-y"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
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
                Send Message
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
