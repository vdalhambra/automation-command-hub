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
      name: "get_business_summary",
      description: "Get a summary of the agency's clients, automations and connections",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Create a new client",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          industry: { type: "string" },
          description: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_automation",
      description: "Create a real automation workflow for a client with a specific action. Use this when the user wants to set up a workflow.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "The client ID to create the automation for" },
          client_name: { type: "string" },
          name: { type: "string", description: "Name of the automation" },
          description: { type: "string" },
          trigger_type: { type: "string", enum: ["Webhook", "Manual", "Schedule"] },
          action_type: { type: "string", enum: ["retell", "webhook", "email"], description: "The action to execute when triggered" },
          action_config: {
            type: "object",
            description: "Configuration for the action. For retell: {api_key, agent_id, from_number}. For webhook: {url}. For email: {to_email, subject, body, api_key}",
          },
        },
        required: ["client_id", "name", "action_type"],
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
      name: "get_client_automations",
      description: "Get all automations for a specific client",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_client",
      description: "Delete a client",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
        },
        required: ["client_id"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, user_context } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userRes = await supabase.auth.getUser(token);
    const user = userRes.data.user;
    if (!user) throw new Error("Unauthorized");

    // Build context
    const clientsRes = await supabase.from("clients").select("id, name, industry").eq("user_id", user.id);
    const automationsRes = await supabase.from("automations").select("id, name, status, action_type, client_id, client_name").eq("user_id", user.id);
    const clients = clientsRes.data ?? [];
    const automations = automationsRes.data ?? [];

    const contextBlock = "Agency clients (" + clients.length + "): " +
      clients.map((c: any) => c.name + " [id:" + c.id + "] (" + c.industry + ")").join(", ") + "\n" +
      "Automations (" + automations.length + "): " +
      automations.map((a: any) => a.name + " [id:" + a.id + "] [" + a.status + "] [action:" + (a.action_type || "none") + "] for " + a.client_name).join(", ");

    const systemPrompt = `You are an AI Command Center for a marketing agency. You help create and manage real automation workflows for clients.

CURRENT AGENCY DATA:
${contextBlock}

CAPABILITIES:
- Create real automation workflows that execute actions (Retell AI calls, webhooks, emails)
- Each automation gets a unique webhook URL that external services (Meta Ads, forms) can call to trigger it
- When creating a Retell automation: ask for API key, Agent ID, and from number if not provided
- When creating a webhook automation: ask for the target URL
- When creating an email automation: ask for recipient, subject, and body
- Always be proactive: if the user wants a workflow, guide them through configuration step by step
- After creating an automation, tell the user the webhook URL so they can configure it in Meta Ads or their form

IMPORTANT GUIDELINES:
- When you need information to create an automation, ask for it conversationally one step at a time
- If the user doesn't have a Retell account, tell them: "Puedes crear una cuenta gratis en https://retellai.com. Una vez dentro: 1) Ve a API Keys y copia tu key, 2) Crea un agente y copia el Agent ID, 3) Ve a Phone Numbers y compra o verifica un número"
- If the user doesn't have the info yet, give them exact steps with URLs
- Once you have ALL required info, create the automation immediately without asking again
- After creating, always tell the user the webhook URL and explain how to use it in Meta Ads: go to Meta Ads Manager → Lead Ads → Instant Form → CRM Integration → paste the webhook URL
- Always respond in the same language the user is writing in`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI error");
    }

    const data = await response.json();
    const choice = data.choices[0];

    if (choice.finish_reason === "tool_calls") {
      const toolCall = choice.message.tool_calls[0];
      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let result = "";

      if (fnName === "get_business_summary") {
        result = contextBlock;

      } else if (fnName === "create_client") {
        const { error } = await supabase.from("clients").insert({
          user_id: user.id,
          name: args.name,
          industry: args.industry || "",
          description: args.description || "",
          connected_apis: 0,
          automations: 0,
        });
        result = error ? "Error: " + error.message : "Client '" + args.name + "' created successfully.";

      } else if (fnName === "create_automation") {
        const { data: newAuto, error } = await supabase.from("automations").insert({
          user_id: user.id,
          client_id: args.client_id,
          client_name: args.client_name || "",
          name: args.name,
          description: args.description || "",
          trigger_type: args.trigger_type || "Webhook",
          action_type: args.action_type,
          action_config: args.action_config || {},
          status: "inactive",
        }).select().single();

        if (error) {
          result = "Error: " + error.message;
        } else {
          const webhookUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/automation-webhook?id=" + newAuto.id;
          await supabase.from("automations").update({ webhook_url: webhookUrl }).eq("id", newAuto.id);
          result = "Automation '" + args.name + "' created successfully.\n" +
            "Action: " + args.action_type + "\n" +
            "Webhook URL: " + webhookUrl + "\n" +
            "Status: inactive (activate it when ready)";
        }

      } else if (fnName === "toggle_automation") {
        const { error } = await supabase.from("automations").update({ status: args.status }).eq("id", args.automation_id).eq("user_id", user.id);
        result = error ? "Error: " + error.message : "Automation set to " + args.status + ".";

      } else if (fnName === "get_client_automations") {
        const { data: autos } = await supabase.from("automations").select("*").eq("client_id", args.client_id);
        result = JSON.stringify(autos ?? []);

      } else if (fnName === "delete_client") {
        const { error } = await supabase.from("clients").delete().eq("id", args.client_id).eq("user_id", user.id);
        result = error ? "Error: " + error.message : "Client deleted.";
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