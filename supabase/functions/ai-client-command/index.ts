import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const agencyClientTools = [
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
      name: "add_note",
      description: "Add or update notes for this client",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string" },
        },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_connection",
      description: "Add an API connection",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string" },
          icon: { type: "string" },
        },
        required: ["service"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_summary",
      description: "Get full summary of this client or business",
      parameters: { type: "object", properties: {} },
    },
  },
];

const independentClientTools = [
  {
    type: "function",
    function: {
      name: "toggle_automation",
      description: "Activate or deactivate one of your automations",
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
      name: "create_automation",
      description: "Create a new automation for your business",
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
      name: "add_connection",
      description: "Add an API connection to your business",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string" },
          icon: { type: "string" },
        },
        required: ["service"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_summary",
      description: "Get a summary of your business data",
      parameters: { type: "object", properties: {} },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, client_id, user_token, user_context, is_independent_client } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const token = user_token ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userRes = await supabase.auth.getUser(token);
    const user = userRes.data.user;
    if (!user) throw new Error("Unauthorized");

    let contextBlock = "";
    let systemPrompt = "";
    let tools = [];
    let client: any = null;

    if (is_independent_client) {
      // Independent client mode
      const automationsRes = await supabase.from("automations").select("id, name, status, trigger_type").eq("user_id", user.id);
      const connectionsRes = await supabase.from("api_connections").select("id, service, status").eq("user_id", user.id);
      const profileRes = await supabase.from("profiles").select("*").eq("id", user.id).single();

      const automations = automationsRes.data ?? [];
      const connections = connectionsRes.data ?? [];
      const profile = profileRes.data;

      contextBlock = "Business: " + (profile?.business_name || "Unknown") + " (" + (profile?.business_sector || "") + ")\n" +
        "Automations (" + automations.length + "): " + (automations.map((a: any) => a.name + " [id:" + a.id + "] [" + a.status + "]").join(", ") || "none") + "\n" +
        "Connections (" + connections.length + "): " + (connections.map((c: any) => c.service + " [" + c.status + "] [id:" + c.id + "]").join(", ") || "none");

      systemPrompt = "You are an AI assistant for " + (profile?.business_name || "this business") + ". You can ONLY manage data belonging to this user. Use tools to execute real actions when requested. Be concise and helpful.\n\n" + contextBlock;
      tools = independentClientTools;

    } else {
      // Agency client mode
      if (!client_id) throw new Error("client_id is required");
      const clientRes = await supabase.from("clients").select("*").eq("id", client_id).eq("user_id", user.id).single();
      if (!clientRes.data) throw new Error("Client not found or access denied");
      client = clientRes.data;

      const automationsRes = await supabase.from("automations").select("id, name, status, trigger_type").eq("client_id", client_id).eq("user_id", user.id);
      const connectionsRes = await supabase.from("client_api_connections").select("id, service, status").eq("client_id", client_id).eq("user_id", user.id);

      const automations = automationsRes.data ?? [];
      const connections = connectionsRes.data ?? [];

      contextBlock = "Client: " + client.name + " (" + client.industry + ")\n" +
        "Automations (" + automations.length + "): " + (automations.map((a: any) => a.name + " [id:" + a.id + "] [" + a.status + "]").join(", ") || "none") + "\n" +
        "Connections (" + connections.length + "): " + (connections.map((c: any) => c.service + " [" + c.status + "] [id:" + c.id + "]").join(", ") || "none");

      systemPrompt = "You are an AI assistant exclusively for the client " + client.name + ". You can ONLY manage data belonging to this client. Use tools to execute real actions. Be concise.\n\n" + contextBlock;
      tools = agencyClientTools;
    }

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

      if (fnName === "toggle_automation") {
        if (is_independent_client) {
          const { error } = await supabase.from("automations").update({ status: args.status }).eq("id", args.automation_id).eq("user_id", user.id);
          result = error ? "Error: " + error.message : "Automation set to " + args.status + ".";
        } else {
          const { data: auto } = await supabase.from("automations").select("id").eq("id", args.automation_id).eq("client_id", client_id).eq("user_id", user.id).single();
          if (!auto) {
            result = "Error: Automation not found or does not belong to this client.";
          } else {
            const { error } = await supabase.from("automations").update({ status: args.status }).eq("id", args.automation_id);
            result = error ? "Error: " + error.message : "Automation set to " + args.status + ".";
          }
        }
      } else if (fnName === "create_automation") {
        const profileRes = await supabase.from("profiles").select("business_name").eq("id", user.id).single();
        const { error } = await supabase.from("automations").insert({
          user_id: user.id,
          name: args.name,
          description: args.description || "",
          trigger_type: args.trigger_type || "Manual",
          status: "inactive",
          client_name: profileRes.data?.business_name || "",
        });
        result = error ? "Error: " + error.message : "Automation '" + args.name + "' created successfully.";
      } else if (fnName === "add_note") {
        const { error } = await supabase.from("clients").update({ notes: args.note }).eq("id", client_id).eq("user_id", user.id);
        result = error ? "Error: " + error.message : "Note saved successfully.";
      } else if (fnName === "add_connection") {
        const icon = args.icon || "🔗";
        if (is_independent_client) {
          const { error } = await supabase.from("api_connections").insert({
            user_id: user.id,
            service: args.service,
            icon: icon,
            status: "connected",
            last_sync: new Date().toISOString(),
          });
          result = error ? "Error: " + error.message : "Connection '" + args.service + "' added.";
        } else {
          const { error } = await supabase.from("client_api_connections").insert({
            user_id: user.id,
            client_id: client_id,
            service: args.service,
            icon: icon,
            status: "connected",
            last_sync: new Date().toISOString(),
          });
          result = error ? "Error: " + error.message : "Connection '" + args.service + "' added.";
        }
      } else if (fnName === "get_summary") {
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
    console.error("ai-client-command error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});