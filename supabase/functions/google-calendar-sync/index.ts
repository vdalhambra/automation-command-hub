import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let userId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Unauthorized");
    userId = user.id;

    const body = await req.json().catch(() => ({}));
    const daysAhead = body.days ?? 7;

    // Get the Google Calendar connection
    const { data: connection, error: connErr } = await supabase
      .from("api_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("service", "Google Calendar")
      .eq("status", "connected")
      .single();

    if (connErr || !connection) {
      throw new Error("Google Calendar not connected");
    }

    let accessToken = connection.access_token;

    // Check if token is expired and refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      if (!connection.refresh_token) throw new Error("No refresh token available");
      const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
      const refreshData = await refreshAccessToken(connection.refresh_token, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      if (refreshData.error) throw new Error("Token refresh failed: " + refreshData.error);
      accessToken = refreshData.access_token;
      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
      await supabase.from("api_connections").update({
        access_token: accessToken,
        token_expires_at: expiresAt,
      }).eq("id", connection.id);
    }

    // Fetch calendar events
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    const calParams = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${calParams}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("Google Calendar API error:", calRes.status, errText);
      // If 401, mark connection as needing reauth
      if (calRes.status === 401) {
        await supabase.from("api_connections").update({ status: "disconnected" }).eq("id", connection.id);
      }
      throw new Error("Google Calendar API error");
    }

    const calData = await calRes.json();
    const events = (calData.items || []).map((e: any) => ({
      id: e.id,
      title: e.summary || "(No title)",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      location: e.location || null,
      description: e.description || null,
      htmlLink: e.htmlLink || null,
    }));

    // Update last_sync
    await supabase.from("api_connections").update({ last_sync: new Date().toISOString() }).eq("id", connection.id);

    // Log success
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      event: `Google Calendar synced (${events.length} events)`,
      status: "success",
      type: "api",
      client_name: "Google Calendar",
    });

    return new Response(
      JSON.stringify({ events }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("google-calendar-sync error:", e);
    // Log error
    if (userId) {
      await supabase.from("activity_logs").insert({
        user_id: userId,
        event: `Google Calendar sync failed: ${e instanceof Error ? e.message : "Unknown"}`,
        status: "error",
        type: "api",
        client_name: "Google Calendar",
      }).catch(() => {});
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", events: [] }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
