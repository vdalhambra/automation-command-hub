import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const exampleCommands = [
  "Crea un workflow de llamadas con Retell para un cliente",
  "Lista mis automatizaciones activas",
  "¿Qué clientes no tienen automatizaciones?",
  "Añade un nuevo cliente",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-command`;

export default function AiCommand() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages from Supabase on mount
  useEffect(() => {
    if (!user) return;
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("ai_command_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) { console.error(error); setIsLoading(false); return; }

      if (data && data.length > 0) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        })));
      } else {
        // First time — show welcome message
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: "Bienvenido al AI Command Center. Puedo ayudarte a crear workflows reales, conectar APIs como Retell AI, y gestionar las automatizaciones de tus clientes. ¿Qué quieres hacer?",
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);
    };
    loadMessages();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const saveMessage = async (role: string, content: string) => {
    if (!user) return;
    await supabase.from("ai_command_messages").insert({
      user_id: user.id,
      role,
      content,
    });
  };

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("ai_command_messages").delete().eq("user_id", user.id);
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Historial borrado. ¿En qué puedo ayudarte?",
      timestamp: new Date(),
    }]);
    toast.success("Historial borrado");
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    await saveMessage("user", input);
    setInput("");
    setIsTyping(true);

    const apiMessages = [...messages, userMsg]
      .filter(m => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = (Date.now() + 1).toString();

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      const data = await resp.json();
      const content = data.content;
      if (!content) throw new Error("No content in response");

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content, timestamp: new Date() }]);
      await saveMessage("assistant", content);

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(errorMsg);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: `⚠️ ${errorMsg}`, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-[calc(100vh-theme(spacing.14)-theme(spacing.12))] flex flex-col animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Command Center</h1>
          <p className="text-sm text-muted-foreground">Crea y gestiona workflows hablando con tu asistente</p>
        </div>
        <Button size="sm" variant="ghost" onClick={clearHistory} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1" /> Borrar historial
        </Button>
      </div>

      <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Cargando historial...</div>
          ) : (
            messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                )}
              </motion.div>
            ))
          )}
          {isTyping && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2.5 text-sm text-muted-foreground">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {exampleCommands.map((cmd) => (
              <button key={cmd} onClick={() => setInput(cmd)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                {cmd}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe un comando..." className="flex-1" disabled={isTyping} />
            <Button type="submit" size="icon" disabled={!input.trim() || isTyping}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </Card>
    </div>
  );
}