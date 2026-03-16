import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tools = [
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Create a new client",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client name" },
          industry: { type: "string", description: "Client industry" },
          description: { type: "string", description: "Brief description" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_client",
      description: "Edit an existing client",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "The client ID" },
          name: { type: "string" },
          industry: { type: "string" },
          description: { type: "string" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_client",
      description: "Delete a client by ID",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "The client ID to delete" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_automation",
      description: "Create a new automation (not assigned to any client)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          trigger_type: { type: "string", enum: ["Webhook", "Schedule", "Event", "Manual"] },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_automation",
      description: "Activate or deactivate an automation",
      parameters: {
        type: "object",
        properties: {
          automation_id: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
        required: ["automation_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_business_summary",
      description: "Get a full summary of the business: clients, automations, connections and recent logs",
      parameters: { type: "object", properties: {} },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userRes = await supabase.auth.getUser(token);
    const user = userRes.data.user;
    if (!user) throw new Error("Unauthorized");

    const clientsRes = await supabase.from("clients").select("id, name, industry, description").eq("user_id", user.id);
    const automationsRes = await supabase.from("automations").select("id, name, status, trigger_type, client_name").eq("user_id", user.id);
    const connectionsRes = await supabase.from("api_connections").select("service, status").eq("user_id", user.id);
    const logsRes = await supabase.from("activity_logs").select("event, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);

    const clients = clientsRes.data ?? [];
    const automations = automationsRes.data ?? [];
    const connections = connectionsRes.data ?? [];
    const logs = logsRes.data ?? [];

    const contextBlock = "Current account data:\n" +
      "Clients (" + clients.length + "): " + (clients.map((c: any) => c.name + " [id:" + c.id + "] (" + c.industry + ")").join(", ") || "none") + "\n" +
      "Automations (" + automations.length + "): " + (automations.map((a: any) => a.name + " [id:" + a.id + "] [" + a.status + "] [client:" + (a.client_name || "unassigned") + "]").join(", ") || "none") + "\n" +
      "API Connections: " + (connections.map((c: any) => c.service + " [" + c.status + "]").join(", ") || "none") + "\n" +
      "Recent logs: " + (logs.map((l: any) => l.event + " [" + l.status + "]").join(", ") || "none");

    const systemPrompt = "You are an AI operations manager for a business automation platform. You manage the user's own account: clients, automations, API connections and business metrics. You have access to tools to execute real actions. Always use the tools when the user asks you to create, edit, delete or modify anything. Never say you did something without calling the tool first. Be concise.\n\n" + contextBlock;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools: tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI API error");
    }

    const data = await response.json();
    const choice = data.choices[0];

    if (choice.finish_reason === "tool_calls") {
      const toolCall = choice.message.tool_calls[0];
      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let result = "";

      if (fnName === "create_client") {
        const { error } = await supabase.from("clients").insert({ user_id: user.id, name: args.name, industry: args.industry || "", description: args.description || "" });
        result = error ? "Error: " + error.message : "Client '" + args.name + "' created successfully.";
      } else if (fnName === "edit_client") {
        const updates: any = {};
        if (args.name) updates.name = args.name;
        if (args.industry) updates.industry = args.industry;
        if (args.description) updates.description = args.description;
        const { error } = await supabase.from("clients").update(updates).eq("id", args.client_id).eq("user_id", user.id);
        result = error ? "Error: " + error.message : "Client updated successfully.";
      } else if (fnName === "delete_client") {
        const { error } = await supabase.from("clients").delete().eq("id", args.client_id).eq("user_id", user.id);
        result = error ? "Error: " + error.message : "Client deleted successfully.";
      } else if (fnName === "create_automation") {
        const { error } = await supabase.from("automations").insert({ user_id: user.id, name: args.name, description: args.description || "", trigger_type: args.trigger_type || "Manual", status: "inactive", client_name: "" });
        result = error ? "Error: " + error.message : "Automation '" + args.name + "' created successfully.";
      } else if (fnName === "toggle_automation") {
        const { error } = await supabase.from("automations").update({ status: args.status }).eq("id", args.automation_id).eq("user_id", user.id);
        result = error ? "Error: " + error.message : "Automation set to " + args.status + ".";
      } else if (fnName === "get_business_summary") {
        result = contextBlock;
      }

      const followUp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            { role: "tool", tool_call_id: toolCall.id, content: result },
          ],
        }),
      });

      const followUpData = await followUp.json();
      const content = followUpData.choices[0].message.content;
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = choice.message.content;
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ai-command error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});