import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const automationId = url.searchParams.get("id");
    if (!automationId) throw new Error("Missing automation id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get automation
    const { data: automation, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("status", "active")
      .single();

    if (error || !automation) throw new Error("Automation not found or inactive");

    // Parse incoming payload
    let payload = {};
    try {
      payload = await req.json();
    } catch { payload = {}; }

    const config = automation.action_config || {};
    let result = "";

    // Execute action based on type
    if (automation.action_type === "webhook") {
      // Forward to external webhook URL
      const targetUrl = config.url;
      if (!targetUrl) throw new Error("No webhook URL configured");
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, automation_id: automationId }),
      });
      result = "Webhook forwarded. Status: " + resp.status;

    } else if (automation.action_type === "retell") {
      // Call Retell AI
      const apiKey = config.api_key;
      const agentId = config.agent_id;
      const toNumber = payload.phone || config.to_number;
      if (!apiKey || !agentId || !toNumber) throw new Error("Missing Retell configuration");
      const resp = await fetch("https://api.retellai.com/v2/create-phone-call", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          to_number: toNumber,
          from_number: config.from_number,
          retell_llm_dynamic_variables: payload,
        }),
      });
      const data = await resp.json();
      result = resp.ok ? "Call initiated: " + data.call_id : "Error: " + JSON.stringify(data);

    } else if (automation.action_type === "email") {
      // Send email via Resend
      const apiKey = Deno.env.get("RESEND_API_KEY") || config.api_key;
      const to = payload.email || config.to_email;
      if (!apiKey || !to) throw new Error("Missing email configuration");
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.from_email || "noreply@yourdomain.com",
          to: [to],
          subject: config.subject || "Automation triggered",
          html: config.body || "<p>Automation triggered successfully.</p>",
        }),
      });
      const data = await resp.json();
      result = resp.ok ? "Email sent: " + data.id : "Error: " + JSON.stringify(data);

    } else {
      result = "No action configured";
    }

    // Update run count and last triggered
    await supabase.from("automations").update({
      last_triggered_at: new Date().toISOString(),
      run_count: (automation.run_count || 0) + 1,
      last_run: new Date().toISOString(),
    }).eq("id", automationId);

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: automation.user_id,
      event: "Automation triggered: " + automation.name,
      client_name: automation.client_name || "",
      status: "success",
      type: "automation",
    });

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("automation-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});