// Placeholder webhook notification calls for n8n integration
const N8N_WEBHOOK_URL = "https://your-n8n-instance.com/webhook";

export async function notifyRSVPCreated(rsvpId: string, eventId: string, userId: string) {
  try {
    await fetch(`${N8N_WEBHOOK_URL}/rsvp-created`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_id: rsvpId, event_id: eventId, user_id: userId, timestamp: new Date().toISOString() }),
    });
  } catch (error) {
    console.warn("n8n webhook (rsvp-created) not configured:", error);
  }
}

export async function notifyRSVPUpdated(rsvpId: string, eventId: string, userId: string) {
  try {
    await fetch(`${N8N_WEBHOOK_URL}/rsvp-updated`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_id: rsvpId, event_id: eventId, user_id: userId, timestamp: new Date().toISOString() }),
    });
  } catch (error) {
    console.warn("n8n webhook (rsvp-updated) not configured:", error);
  }
}

export async function notifyRSVPCancelled(rsvpId: string, eventId: string, userId: string) {
  try {
    await fetch(`${N8N_WEBHOOK_URL}/rsvp-cancelled`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_id: rsvpId, event_id: eventId, user_id: userId, timestamp: new Date().toISOString() }),
    });
  } catch (error) {
    console.warn("n8n webhook (rsvp-cancelled) not configured:", error);
  }
}
