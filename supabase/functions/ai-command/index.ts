import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tools = [
  {
    name: "get_business_summary",
    description: "Get a summary of the agency's clients, automations and connections",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_client",
    description: "Create a new client",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        industry: { type: "string" },
        description: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_retell_agents",
    description: "List all agents in the user's Retell account",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_retell_agent",
    description: "Create a new AI agent in Retell with a custom prompt and voice",
    input_schema: {
      type: "object",
      properties: {
        agent_name: { type: "string" },
        prompt: { type: "string", description: "Full system prompt for the agent" },
        voice_id: { type: "string", description: "Default: 11labs-Adrian" },
      },
      required: ["agent_name", "prompt"],
    },
  },
  {
    name: "list_retell_phone_numbers",
    description: "List all phone numbers in the user's Retell account",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_automation",
    description: "Create a real automation workflow for a client",
    input_schema: {
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
  {
    name: "toggle_automation",
    description: "Activate or deactivate an automation",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        status: { type: "string", enum: ["active", "inactive"] },
      },
      required: ["automation_id", "status"],
    },
  },
  {
    name: "get_client_automations",
    description: "Get all automations for a specific client",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "delete_client",
    description: "Delete a client",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
];

async function executeTool(
  fnName: string,
  args: any,
  supabase: any,
  user: any,
  retellConnection: any,
  contextBlock: string
): Promise<string> {
  if (fnName === "get_business_summary") {
    return contextBlock;

  } else if (fnName === "create_client") {
    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: args.name,
      industry: args.industry || "",
      description: args.description || "",
      connected_apis: 0,
      automations: 0,
    });
    return error ? "Error: " + error.message : "Client '" + args.name + "' created.";

  } else if (fnName === "list_retell_agents") {
    if (!retellConnection?.api_key_plain) return "Retell not connected";
    const resp = await fetch("https://api.retellai.com/list-agents", {
      headers: { "Authorization": "Bearer " + retellConnection.api_key_plain },
    });
    return JSON.stringify(await resp.json());

  } else if (fnName === "create_retell_agent") {
    if (!retellConnection?.api_key_plain) return "Retell not connected";
    const llmResp = await fetch("https://api.retellai.com/create-retell-llm", {
      method: "POST",
      headers: { "Authorization": "Bearer " + retellConnection.api_key_plain, "Content-Type": "application/json" },
      body: JSON.stringify({ general_prompt: args.prompt, model: "gpt-4o-mini" }),
    });
    const llmData = await llmResp.json();
    if (!llmResp.ok || !llmData.llm_id) return "Error creating LLM: " + JSON.stringify(llmData);
    const agentResp = await fetch("https://api.retellai.com/create-agent", {
      method: "POST",
      headers: { "Authorization": "Bearer " + retellConnection.api_key_plain, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_name: args.agent_name,
        response_engine: { type: "retell-llm", llm_id: llmData.llm_id },
        voice_id: args.voice_id || "11labs-Adrian",
      }),
    });
    const agentData = await agentResp.json();
    return agentResp.ok && agentData.agent_id
      ? "Agent created. agent_id: " + agentData.agent_id
      : "Error: " + JSON.stringify(agentData);

  } else if (fnName === "list_retell_phone_numbers") {
    if (!retellConnection?.api_key_plain) return "Retell not connected";
    const resp = await fetch("https://api.retellai.com/list-phone-numbers", {
      headers: { "Authorization": "Bearer " + retellConnection.api_key_plain },
    });
    return JSON.stringify(await resp.json());

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
    if (error) return "Error: " + error.message;
    const webhookUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/automation-webhook?id=" + newAuto.id;
    await supabase.from("automations").update({ webhook_url: webhookUrl }).eq("id", newAuto.id);
    return "Automation created. webhook_url: " + webhookUrl;

  } else if (fnName === "toggle_automation") {
    const { error } = await supabase.from("automations").update({ status: args.status }).eq("id", args.automation_id).eq("user_id", user.id);
    return error ? "Error: " + error.message : "Automation set to " + args.status + ".";

  } else if (fnName === "get_client_automations") {
    const { data: autos } = await supabase.from("automations").select("*").eq("client_id", args.client_id);
    return JSON.stringify(autos ?? []);

  } else if (fnName === "delete_client") {
    const { error } = await supabase.from("clients").delete().eq("id", args.client_id).eq("user_id", user.id);
    return error ? "Error: " + error.message : "Client deleted.";
  }

  return "Unknown tool: " + fnName;
}

async function runAgentLoop(
  messages: any[],
  systemPrompt: string,
  tools: any[],
  supabase: any,
  user: any,
  retellConnection: any,
  contextBlock: string,
  anthropicKey: string,
  maxIterations = 8
): Promise<string> {
  let currentMessages = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: currentMessages,
        tools,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Anthropic error");

    const toolUseBlocks = data.content?.filter((b: any) => b.type === "tool_use") ?? [];
    const textBlock = data.content?.find((b: any) => b.type === "text");

    // No more tool calls — return final text
    if (toolUseBlocks.length === 0 || data.stop_reason === "end_turn") {
      return textBlock?.text || "Done.";
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse: any) => {
        const result = await executeTool(
          toolUse.name,
          toolUse.input,
          supabase,
          user,
          retellConnection,
          contextBlock
        );
        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        };
      })
    );

    // Add assistant response and tool results to messages
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: data.content },
      { role: "user", content: toolResults },
    ];
  }

  return "Max iterations reached.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userRes = await supabase.auth.getUser(token);
    const user = userRes.data.user;
    if (!user) throw new Error("Unauthorized");

    const clientsRes = await supabase.from("clients").select("id, name, industry").eq("user_id", user.id);
    const automationsRes = await supabase.from("automations").select("id, name, status, action_type, client_id, client_name, webhook_url").eq("user_id", user.id);
    const agencyConnectionsRes = await supabase.from("api_connections").select("service, api_key_plain, status").eq("user_id", user.id).eq("status", "connected");
    const clientConnectionsRes = await supabase.from("client_api_connections").select("service, client_id, status").eq("user_id", user.id);

    const clients = clientsRes.data ?? [];
    const automations = automationsRes.data ?? [];
    const agencyConnections = agencyConnectionsRes.data ?? [];
    const clientConnections = clientConnectionsRes.data ?? [];
    const retellConnection = agencyConnections.find((c: any) => c.service === "Retell AI");

    const contextBlock =
      "AGENCY CONNECTIONS (your own APIs): " + (agencyConnections.map((c: any) => c.service).join(", ") || "none") + "\n" +
      (retellConnection ? "✅ Retell AI: CONNECTED\n" : "❌ Retell AI: NOT CONNECTED\n") +
      "\nCLIENTS (" + clients.length + "):\n" +
      clients.map((c: any) => {
        const clientConns = clientConnections.filter((cc: any) => cc.client_id === c.id);
        const clientAutos = automations.filter((a: any) => a.client_id === c.id);
        return "- " + c.name + " [id:" + c.id + "] (" + c.industry + ")\n" +
          "  APIs: " + (clientConns.map((cc: any) => cc.service).join(", ") || "none") + "\n" +
          "  Automations: " + (clientAutos.map((a: any) => a.name + " [" + a.status + "] [action:" + (a.action_type || "none") + "]").join(", ") || "none");
      }).join("\n");

    const systemPrompt = `You are an AI Command Center for a marketing agency. You are highly capable and autonomous.

CURRENT AGENCY DATA:
${contextBlock}

YOUR CAPABILITIES:
- Create and manage clients, automations, and connections
- Create Retell AI agents with custom prompts — never ask for agent IDs, create them yourself
- List phone numbers from Retell and use them in automations
- Generate webhook URLs for Meta Ads and other platforms

SECURITY RULES (CRITICAL):
- Agency APIs are ONLY for the agency — never share with clients
- Each client's APIs are ONLY for that client
- Never cross data between clients
- The agency CAN create automations for clients using agency APIs

AUTONOMOUS WORKFLOW FOR RETELL:
1. Understand what the user wants
2. Ask for business context if needed (one question at a time)
3. Create the Retell LLM + agent automatically with a professional prompt
4. List phone numbers and select the first available one automatically
5. Create the automation with agent_id and phone number
6. Activate it automatically using toggle_automation
7. Give the webhook URL with Meta Ads setup instructions

IMPORTANT:
- If Retell is CONNECTED, use it automatically — never ask for the API key
- Always activate automations after creating them
- Always provide the webhook URL at the end
- Respond in the same language as the user
- Complete the full setup autonomously without unnecessary back-and-forth`;

    const finalResponse = await runAgentLoop(
      messages,
      systemPrompt,
      tools,
      supabase,
      user,
      retellConnection,
      contextBlock,
      ANTHROPIC_API_KEY
    );

    return new Response(JSON.stringify({ content: finalResponse }), {
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
