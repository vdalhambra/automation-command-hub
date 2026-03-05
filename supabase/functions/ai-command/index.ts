import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract user JWT to fetch their data
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    let contextBlock = "No user context available.";
    if (user) {
      // Fetch calendar events if connected
      let calendarEvents: any[] = [];
      const { data: calConn } = await supabase
        .from("api_connections")
        .select("access_token, token_expires_at, refresh_token")
        .eq("user_id", user.id)
        .eq("service", "Google Calendar")
        .eq("status", "connected")
        .single();

      if (calConn?.access_token) {
        try {
          const now = new Date();
          const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const calParams = new URLSearchParams({
            timeMin: now.toISOString(), timeMax: timeMax.toISOString(),
            singleEvents: "true", orderBy: "startTime", maxResults: "20",
          });
          const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?${calParams}`,
            { headers: { Authorization: `Bearer ${calConn.access_token}` } }
          );
          if (calRes.ok) {
            const calData = await calRes.json();
            calendarEvents = (calData.items || []).map((e: any) => ({
              title: e.summary || "(No title)",
              start: e.start?.dateTime || e.start?.date || "",
              location: e.location || "",
            }));
          }
        } catch { /* ignore calendar errors in AI context */ }
      }

      const [clientsRes, automationsRes, connectionsRes] = await Promise.all([
        supabase.from("clients").select("name, industry").eq("user_id", user.id),
        supabase.from("automations").select("name, status, client_name").eq("user_id", user.id),
        supabase.from("api_connections").select("service, status").eq("user_id", user.id),
      ]);

      const clients = clientsRes.data ?? [];
      const automations = automationsRes.data ?? [];
      const connections = connectionsRes.data ?? [];
      const activeAutomations = automations.filter((a) => a.status === "active");

      const calendarBlock = calendarEvents.length > 0
        ? `\n- Upcoming Calendar Events (next 7 days):\n${calendarEvents.map((e) => `  • ${e.start}: ${e.title}${e.location ? ` (${e.location})` : ""}`).join("\n")}`
        : "\n- Calendar: No upcoming events (or not connected)";

      contextBlock = `User's current data:
- Clients (${clients.length}): ${clients.map((c) => `${c.name} (${c.industry})`).join(", ") || "none"}
- Automations (${automations.length} total, ${activeAutomations.length} active): ${automations.map((a) => `${a.name} [${a.status}] for ${a.client_name}`).join(", ") || "none"}
- API Connections (${connections.length}): ${connections.map((c) => `${c.service} [${c.status}]`).join(", ") || "none"}${calendarBlock}`;
    }

    const systemPrompt = `You are an AI operations assistant for a business automation platform. You help the user manage their clients, automations, and API connections. You have access to the user's current data context below. You can describe actions to take but cannot execute them directly yet. Be concise, helpful, and specific. Use markdown formatting for clarity.

${contextBlock}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-command error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
