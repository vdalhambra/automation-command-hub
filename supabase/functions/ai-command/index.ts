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
      name: "list_retell_agents",
      description: "List all agents in the user's Retell account",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_retell_agent",
      description: "Create a new AI agent in Retell with a custom prompt and voice",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Name for the agent" },
          prompt: { type: "string", description: "The system prompt for the agent - what it should say and do" },
          voice_id: { type: "string", description: "Voice ID to use. Default: '11labs-Adrian'" },
          language: { type: "string", description: "Language code. Default: 'es-ES' for Spanish" },
        },
        required: ["agent_name", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_retell_phone_numbers",
      description: "List all phone numbers in the user's Retell account",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_automation",
      description: "Create a real automation workflow for a client with a specific action",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          client_name: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          trigger_type: { type: "string", enum: ["Webhook", "Manual", "Schedule"] },
          action_type: { type: "string", enum: ["retell", "webhook", "email"] },
          action_config: { type: "object" },
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
    const { messages } = await req.json();
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

    const clientsRes = await supabase.from("clients").select("id, name, industry").eq("user_id", user.id);
    const automationsRes = await supabase.from("automations").select("id, name, status, action_type, client_id, client_name").eq("user_id", user.id);
    const connectionsRes = await supabase.from("api_connections").select("service, api_key_plain, status").eq("user_id", user.id).eq("status", "connected");

    const clients = clientsRes.data ?? [];
    const automations = automationsRes.data ?? [];
    const connections = connectionsRes.data ?? [];
    const retellConnection = connections.find((c: any) => c.service === "Retell AI");

    const contextBlock =
      "Agency clients (" + clients.length + "): " + clients.map((c: any) => c.name + " [id:" + c.id + "] (" + c.industry + ")").join(", ") + "\n" +
      "Automations (" + automations.length + "): " + automations.map((a: any) => a.name + " [id:" + a.id + "] [" + a.status + "] [action:" + (a.action_type || "none") + "] for " + a.client_name).join(", ") + "\n" +
      "Connected APIs: " + (connections.map((c: any) => c.service).join(", ") || "none") + "\n" +
      (retellConnection ? "Retell API Key: AVAILABLE" : "Retell API Key: NOT CONNECTED");

    const systemPrompt = `You are an AI Command Center for a marketing agency. You help create and manage real automation workflows for clients.

CURRENT AGENCY DATA:
${contextBlock}

CAPABILITIES:
- Create real automation workflows that execute actions (Retell AI calls, webhooks, emails)
- Create Retell AI agents directly with custom prompts — you don't need to ask the user for agent IDs, create the agent yourself
- List and use existing Retell agents and phone numbers
- Each automation gets a unique webhook URL that external services (Meta Ads, forms) can trigger

WORKFLOW FOR RETELL AUTOMATIONS:
1. Ask what the agent should do (e.g. "follow up leads and book appointments")
2. Ask for the client's business context (name, services, tone)
3. Create the Retell agent automatically with a professional prompt
4. List available phone numbers and ask which to use
5. Create the automation and activate it
6. Give the user the webhook URL with instructions for Meta Ads

IMPORTANT GUIDELINES:
- If Retell API Key shows as AVAILABLE, use it automatically — never ask for it
- Create Retell agents yourself based on the user's description — don't ask for agent IDs
- If the user doesn't have Retell connected, tell them to go to Connections → Add Connection → Retell AI
- Always respond in the same language the user is writing in
- Be proactive and complete the full setup without unnecessary back-and-forth`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
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
        result = error ? "Error: " + error.message : "Client '" + args.name + "' created.";

      } else if (fnName === "list_retell_agents") {
        if (!retellConnection?.api_key_plain) { result = "Retell not connected"; }
        else {
          const resp = await fetch("https://api.retellai.com/list-agents", {
            headers: { "Authorization": "Bearer " + retellConnection.api_key_plain },
          });
          const agentsData = await resp.json();
          result = JSON.stringify(agentsData);
        }

      } else if (fnName === "create_retell_agent") {
        if (!retellConnection?.api_key_plain) { result = "Retell not connected"; }
        else {
          // Step 1: Create LLM first
          const llmResp = await fetch("https://api.retellai.com/create-retell-llm", {
            method: "POST",
            headers: { "Authorization": "Bearer " + retellConnection.api_key_plain, "Content-Type": "application/json" },
            body: JSON.stringify({
              general_prompt: args.prompt,
              model: "gpt-4o-mini",
            }),
          });
          const llmData = await llmResp.json();
          console.log("LLM response:", JSON.stringify(llmData));
          if (!llmResp.ok || !llmData.llm_id) {
            result = "Error creating LLM: " + JSON.stringify(llmData);
          } else {
            // Step 2: Create agent with the LLM
            const agentResp = await fetch("https://api.retellai.com/create-agent", {
              method: "POST",
              headers: { "Authorization": "Bearer " + retellConnection.api_key_plain, "Content-Type": "application/json" },
              body: JSON.stringify({
                agent_name: args.agent_name,
                response_engine: {
                  type: "retell-llm",
                  llm_id: llmData.llm_id,
                },
                voice_id: args.voice_id || "11labs-Adrian"
              }),
            });
            const agentData = await agentResp.json();
            console.log("Agent response:", JSON.stringify(agentData));
            result = agentResp.ok && agentData.agent_id
              ? "Agent created successfully. agent_id: " + agentData.agent_id + " llm_id: " + llmData.llm_id
              : "Error creating agent: " + JSON.stringify(agentData);
          }
        }

      } else if (fnName === "list_retell_phone_numbers") {
        if (!retellConnection?.api_key_plain) { result = "Retell not connected"; }
        else {
          const resp = await fetch("https://api.retellai.com/list-phone-numbers", {
            headers: { "Authorization": "Bearer " + retellConnection.api_key_plain },
          });
          const numbersData = await resp.json();
          result = JSON.stringify(numbersData);
        }

      } else if (fnName === "create_automation") {
        if (args.action_type === "retell" && !args.action_config?.api_key && retellConnection?.api_key_plain) {
          args.action_config = { ...args.action_config, api_key: retellConnection.api_key_plain };
        }
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
          result = "Automation '" + args.name + "' created.\nWebhook URL: " + webhookUrl + "\nStatus: inactive";
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
        headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
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