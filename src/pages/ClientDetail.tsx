import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Bot, User, Send, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { Zap, Plug, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateInvitation, useInvitations } from "@/hooks/useInvitations";
import {
  useClientDetail,
  useUpdateClientDetail,
  useClientAutomations,
  useClientApiConnections,
  useCreateClientApiConnection,
  useClientActivityLogs,
  useToggleClientAutomation,
} from "@/hooks/useClientDetail";

const serviceOptions = ["Google Calendar", "Meta Ads", "Retell AI", "Slack Webhook", "Custom API", "Stripe", "HubSpot"];
const serviceIcons: Record<string, string> = {
  "Google Calendar": "📅", "Meta Ads": "📢", "Retell AI": "🤖",
  "Slack Webhook": "💬", "Custom API": "🔗", "Stripe": "💳", "HubSpot": "🧡",
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const { data: client, isLoading } = useClientDetail(clientId!);

// Poll for notes changes every 3 seconds
useEffect(() => {
  const interval = setInterval(() => {
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
  }, 3000);
  return () => clearInterval(interval);
}, [clientId]);
  const { data: automations = [] } = useClientAutomations(clientId!);
  const { data: connections = [] } = useClientApiConnections(clientId!);
  const { data: logs = [] } = useClientActivityLogs(clientId!);

  const updateClient = useUpdateClientDetail();
  const createConnection = useCreateClientApiConnection();
  const toggleAutomation = useToggleClientAutomation();
  const createInvitation = useCreateInvitation();
const { data: invitations = [] } = useInvitations();
const existingInvitation = invitations.find((inv: any) => inv.client_id === clientId && inv.status === "pending");
  const queryClient = useQueryClient();
// Realtime sync
useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel("agency-client-realtime-" + clientId)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations", filter: `client_id=eq.${clientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["client-automations", clientId] });
          queryClient.invalidateQueries({ queryKey: ["client", clientId] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "client_api_connections", filter: `client_id=eq.${clientId}` },
        () => queryClient.invalidateQueries({ queryKey: ["client-connections", clientId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" },
  () => queryClient.invalidateQueries({ queryKey: ["client", clientId] }))
  .on("postgres_changes", { event: "*", schema: "public", table: "clients" },
  () => {
    console.log("REALTIME: clients changed");
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
  })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId]);
  const [editOpen, setEditOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", industry: "", description: "", notes: "", contact_name: "", contact_email: "" });
  const [connForm, setConnForm] = useState({ service: "", apiKey: "" });
  const [autoForm, setAutoForm] = useState({ name: "", description: "", triggerType: "Webhook" });
  const [notes, setNotes] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", content: `Hi! I'm your AI assistant for this client. Ask me anything about their automations, connections, or how to optimize their workflows.` }]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (client) {
      setEditForm({
        name: client.name ?? "",
        industry: client.industry ?? "",
        description: client.description ?? "",
        notes: client.notes ?? "",
        contact_name: client.contact_name ?? "",
        contact_email: client.contact_email ?? "",
      });
      setNotes(client.notes ?? "");
    }
  }, [client]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleEditSave = () => {
    updateClient.mutate({ id: clientId!, ...editForm });
    setEditOpen(false);
  };

  const handleNotesSave = () => {
    updateClient.mutate({ id: clientId!, notes });
  };

  const handleAddConnection = () => {
    if (!connForm.service) { toast.error("Select a service"); return; }
    createConnection.mutate({
      client_id: clientId!,
      service: connForm.service,
      api_key_encrypted: connForm.apiKey || undefined,
      icon: serviceIcons[connForm.service] || "🔗",
    });
    setConnOpen(false);
    setConnForm({ service: "", apiKey: "" });
  };

  const handleAddAutomation = async () => {
    if (!autoForm.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("automations").insert({
      user_id: user!.id,
      client_id: clientId!,
      client_name: client?.name ?? "",
      name: autoForm.name,
      description: autoForm.description,
      trigger_type: autoForm.triggerType,
      status: "inactive",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Automation created");
    setAutoOpen(false);
    setAutoForm({ name: "", description: "", triggerType: "Webhook" });
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: chatInput };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const clientContext = `Client: ${client?.name} (${client?.industry}). Automations: ${automations.map((a: any) => a.name + " [" + a.status + "]").join(", ") || "none"}. Connections: ${connections.map((c: any) => c.service + " [" + c.status + "]").join(", ") || "none"}.`;
      const allMessages = [
        { role: "system", content: `You are an AI assistant for the client ${client?.name}. ${clientContext} Help manage and optimize their operations. Be concise.` },
        ...messages.filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: chatInput },
      ];

     const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token;
console.log("TOKEN:", token);const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-client-command`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  },
 body: JSON.stringify({ messages: allMessages.slice(1), client_id: clientId, user_token: token }),
});
if (!resp.ok) {
  const errText = await resp.text();
  console.error("Edge Function error:", resp.status, errText);
  throw new Error("Edge Function error " + resp.status);
}
const data = await resp.json();
console.log("RESPONSE:", data, "CONTENT:", data.content);


      queryClient.invalidateQueries({ queryKey: ["client-automations", clientId] });
queryClient.invalidateQueries({ queryKey: ["client-connections", clientId] });
queryClient.invalidateQueries({ queryKey: ["client", clientId] });
const assistantMsg = { id: (Date.now() + 1).toString(), role: "assistant" as const, content: data.content };
console.log("ADDING MESSAGE:", assistantMsg);
setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
  console.error("CATCH ERROR:", e);
  toast.error(e.message || "AI error");
}finally {
      setIsTyping(false);
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!client) return <div className="p-6 text-muted-foreground">Client not found.</div>;

  const activeAutomations = automations.filter((a: any) => a.status === "active").length;
  const connectedApis = connections.filter((c: any) => c.status === "connected").length;
  const recentLogs = logs.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate("/clients")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Clients
          </button>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{client.industry}</span>
            {client.contact_name && <span className="text-sm text-muted-foreground">{client.contact_name}</span>}
            {client.contact_email && <span className="text-sm text-muted-foreground">{client.contact_email}</span>}
          </div>
        </div>
        <Button
  size="sm"
  variant="outline"
  onClick={async () => {
    if (existingInvitation) {
      const link = `${window.location.origin}/signup?invite=${existingInvitation.token}`;
      navigator.clipboard.writeText(link);
      toast.success("Invitation link copied to clipboard!");
    } else {
      const inv = await createInvitation.mutateAsync(clientId!);
      const link = `${window.location.origin}/signup?invite=${inv.token}`;
      navigator.clipboard.writeText(link);
      toast.success("Invitation link created and copied!");
    }
  }}
>
  <Link className="h-4 w-4 mr-1" /> Invite Client
</Button>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline">Edit Client</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div><Label>Industry</Label><Input value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
              <div><Label>Contact Name</Label><Input value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} /></div>
              <div><Label>Contact Email</Label><Input value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleEditSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Automations" value={activeAutomations} icon={Zap} />
        <MetricCard title="Total Automations" value={automations.length} icon={Zap} />
        <MetricCard title="Connected APIs" value={connectedApis} icon={Plug} />
        <MetricCard title="Activity Logs" value={recentLogs} icon={Activity} />
      </div>

      {/* Automations + Connections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automations */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Automations</CardTitle>
            <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Automation</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div><Label>Name</Label><Input value={autoForm.name} onChange={(e) => setAutoForm({ ...autoForm, name: e.target.value })} placeholder="Automation name" /></div>
                  <div><Label>Description</Label><Textarea value={autoForm.description} onChange={(e) => setAutoForm({ ...autoForm, description: e.target.value })} placeholder="What does it do?" /></div>
                  <div><Label>Trigger</Label>
                    <Select value={autoForm.triggerType} onValueChange={(v) => setAutoForm({ ...autoForm, triggerType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Webhook">Webhook</SelectItem>
                        <SelectItem value="Schedule">Schedule</SelectItem>
                        <SelectItem value="Event">Event</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleAddAutomation}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {automations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No automations yet</p>
            ) : (
              <div className="space-y-3">
                {automations.map((auto: any, i: number) => (
                  <motion.div key={auto.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{auto.name}</span>
                        <StatusBadge status={auto.status} />
                      </div>
                      <span className="text-xs text-muted-foreground">{auto.trigger_type}</span>
                    </div>
                    <Switch checked={auto.status === "active"} onCheckedChange={() => toggleAutomation.mutate({ id: auto.id, status: auto.status, clientId: clientId! })} />
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Connections */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">API Connections</CardTitle>
            <Dialog open={connOpen} onOpenChange={setConnOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Connection</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div><Label>Service</Label>
                    <Select value={connForm.service} onValueChange={(v) => setConnForm({ ...connForm, service: v })}>
                      <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                      <SelectContent>{serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>API Key</Label><Input type="password" value={connForm.apiKey} onChange={(e) => setConnForm({ ...connForm, apiKey: e.target.value })} placeholder="Paste your key" /></div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleAddConnection}>Connect</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No connections yet</p>
            ) : (
              <div className="space-y-3">
                {connections.map((conn: any, i: number) => (
                  <motion.div key={conn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{conn.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{conn.service}</p>
                        <p className="text-xs text-muted-foreground">{conn.last_sync ? new Date(conn.last_sync).toLocaleDateString() : "Never"}</p>
                      </div>
                    </div>
                    <StatusBadge status={conn.status} />
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder="Add notes about this client..."
            className="min-h-[100px] resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">Auto-saves when you click away</p>
        </CardContent>
      </Card>

      {/* AI Assistant */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">AI Assistant — {client.name}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded bg-accent flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground animate-pulse">Thinking...</div>
              </div>
            )}
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder={`Ask about ${client.name}...`} className="flex-1" />
            <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}