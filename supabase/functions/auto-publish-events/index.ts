import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find draft events whose scheduled_publish_at has passed
    const now = new Date().toISOString();
    const { data: dueEvents, error: fetchError } = await supabase
      .from("events")
      .select("id, title, date_time")
      .eq("published", false)
      .not("scheduled_publish_at", "is", null)
      .lte("scheduled_publish_at", now);

    if (fetchError) throw fetchError;

    if (!dueEvents || dueEvents.length === 0) {
      return new Response(JSON.stringify({ published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventIds = dueEvents.map((e) => e.id);

    // Publish them
    const { error: updateError } = await supabase
      .from("events")
      .update({ published: true, scheduled_publish_at: null })
      .in("id", eventIds);

    if (updateError) throw updateError;

    // Send notifications for each newly published event
    const { data: approvedUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "approved");

    if (approvedUsers && approvedUsers.length > 0) {
      for (const event of dueEvents) {
        const notifRows = approvedUsers.map((u) => ({
          user_id: u.user_id,
          title: "New Event: " + event.title,
          message: `${event.title} is now live. Check it out and RSVP!`,
          type: "event",
          metadata: { action: "new_event", event_id: event.id },
        }));
        await supabase.from("notifications").insert(notifRows);
      }
    }

    console.log(`Auto-published ${eventIds.length} events: ${eventIds.join(", ")}`);

    return new Response(
      JSON.stringify({ published: eventIds.length, event_ids: eventIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-publish error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
