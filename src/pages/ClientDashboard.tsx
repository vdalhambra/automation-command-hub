import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Link, Settings, LogOut, Plus, Send, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile, useLinkedClientId } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";

const serviceOptions = ["Google Calendar", "Meta Ads", "Retell AI", "Slack Webhook", "Custom API", "Stripe", "HubSpot"];
const serviceIcons: Record<string, string> = {
  "Google Calendar": "📅", "Meta Ads": "📢", "Retell AI": "🤖",
  "Slack Webhook": "💬", "Custom API": "🔗", "Stripe": "💳", "HubSpot": "🧡",
};

interface Message { id: string; role: "user" | "assistant"; content: string; }

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: linkedClient, isLoading: linkedClientLoading } = useLinkedClientId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [connectAgencyOpen, setConnectAgencyOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "Hi! I'm your AI assistant. I can help you manage your automations, connections, and business operations. What would you like to do?" }
  ]);
  const [editForm, setEditForm] = useState({ full_name: "", business_name: "", business_sector: "", business_description: "", business_website: "", business_phone: "" });
  const [connForm, setConnForm] = useState({ service: "", apiKey: "" });
  const [autoForm, setAutoForm] = useState({ name: "", description: "", trigger_type: "Manual" });
  const [notes, setNotes] = useState("");

  const { data: automations = [] } = useQuery({
    queryKey: ["client-own-automations", user?.id, linkedClient?.id],
    queryFn: async () => {
      if (linkedClient) {
        const { data, error } = await supabase.from("automations").select("*").eq("client_id", linkedClient.id).order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      } else {
        const { data, error } = await supabase.from("automations").select("*").eq("user_id", user!.id).is("client_id", null).order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      }
    },
    enabled: !!user && !linkedClientLoading,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["client-own-connections", user?.id, linkedClient?.id],
    queryFn: async () => {
      if (linkedClient) {
        const { data, error } = await supabase.from("client_api_connections").select("*").eq("client_id", linkedClient.id).order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      } else {
        const { data, error } = await supabase.from("api_connections").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      }
    },
    enabled: !!user && !linkedClientLoading,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["client-own-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_logs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["client-own-calendar", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").eq("user_id", user!.id).order("start", { ascending: true }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: agencyConnection } = useQuery({
    queryKey: ["agency-connection", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, user_id").eq("linked_user_id", user!.id).single();
      if (error || !data) return null;
      const { data: agencyProfile } = await supabase.from("profiles").select("agency_name, full_name").eq("id", data.user_id).single();
      return { ...data, agencyName: agencyProfile?.agency_name || agencyProfile?.full_name || "Your Agency" };
    },
    enabled: !!user,
  });

  const { data: clientNotes } = useQuery({
  queryKey: ["client-notes", linkedClient?.id],
  queryFn: async () => {
    if (!linkedClient) return "";
    const { data, error } = await supabase.from("clients").select("notes").eq("id", linkedClient.id).single();
    if (error) return "";
    return data?.notes || "";
  },
  enabled: !!linkedClient,
});

useEffect(() => {
  if (clientNotes !== undefined) setNotes(clientNotes);
}, [clientNotes]);

  useEffect(() => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name || "",
        business_name: profile.business_name || "",
        business_sector: profile.business_sector || "",
        business_description: profile.business_description || "",
        business_website: profile.business_website || "",
        business_phone: profile.business_phone || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("client-realtime-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations" },
        () => qc.invalidateQueries({ queryKey: ["client-own-automations", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "api_connections" },
        () => qc.invalidateQueries({ queryKey: ["client-own-connections", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "client_api_connections" },
        () => qc.invalidateQueries({ queryKey: ["client-own-connections", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" },
  () => {
    qc.invalidateQueries({ queryKey: ["agency-connection", user.id] });
    qc.invalidateQueries({ queryKey: ["client-notes", linkedClient?.id] });
  })
      
  .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleEditSave = async () => {
    await updateProfile.mutateAsync(editForm);
    if (linkedClient) {
      await supabase.from("clients").update({
        name: editForm.business_name || editForm.full_name,
        industry: editForm.business_sector,
        description: editForm.business_description,
        contact_name: editForm.full_name,
      }).eq("id", linkedClient.id);
    }
    setEditOpen(false);
  };

  const handleAddConnection = async () => {
    if (!connForm.service) { toast.error("Select a service"); return; }
    if (linkedClient) {
      const { error } = await supabase.from("client_api_connections").insert({
        user_id: linkedClient.user_id,
        client_id: linkedClient.id,
        service: connForm.service,
        icon: serviceIcons[connForm.service] || "🔗",
        status: "connected",
        last_sync: new Date().toISOString(),
        api_key_encrypted: connForm.apiKey || null,
      });
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("api_connections").insert({
        user_id: user!.id,
        service: connForm.service,
        icon: serviceIcons[connForm.service] || "🔗",
        status: "connected",
        last_sync: new Date().toISOString(),
        api_key_encrypted: connForm.apiKey || null,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Connection added");
    qc.invalidateQueries({ queryKey: ["client-own-connections", user?.id, linkedClient?.id] });
    setConnOpen(false);
    setConnForm({ service: "", apiKey: "" });
  };

  const handleAddAutomation = async () => {
    if (!autoForm.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("automations").insert({
      user_id: linkedClient ? linkedClient.user_id : user!.id,
      client_id: linkedClient ? linkedClient.id : null,
      name: autoForm.name,
      description: autoForm.description,
      trigger_type: autoForm.trigger_type,
      status: "inactive",
      client_name: profile?.business_name || "",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Automation created");
    qc.invalidateQueries({ queryKey: ["client-own-automations", user?.id, linkedClient?.id] });
    setAutoOpen(false);
    setAutoForm({ name: "", description: "", trigger_type: "Manual" });
  };

  const handleToggleAutomation = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const { error } = await supabase.from("automations").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["client-own-automations", user?.id, linkedClient?.id] });
  };
const handleNotesSave = async () => {
  if (!linkedClient) return;
  await supabase.from("clients").update({ notes }).eq("id", linkedClient.id);
  toast.success("Notes saved");
};
  const handleConnectAgency = async () => {
    if (!inviteCode.trim()) { toast.error("Enter an invitation code"); return; }
    const { data, error } = await supabase.from("invitations").select("*").eq("token", inviteCode.trim()).eq("status", "pending").single();
    if (error || !data) { toast.error("Invalid or expired invitation code"); return; }
    await supabase.from("invitations").update({ status: "accepted", accepted_by: user!.id }).eq("token", inviteCode.trim());
    await supabase.from("clients").update({ linked_user_id: user!.id }).eq("id", data.client_id);
    toast.success("Connected to your agency successfully!");
    qc.invalidateQueries({ queryKey: ["agency-connection", user?.id] });
    setConnectAgencyOpen(false);
    setInviteCode("");
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: chatInput };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-client-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [...messages.filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content })), { role: "user", content: chatInput }],
          client_id: linkedClient ? linkedClient.id : null,
          user_token: token,
          is_independent_client: !linkedClient,
        }),
      });
      if (!resp.ok) throw new Error("AI error " + resp.status);
      const data = await resp.json();
      qc.invalidateQueries({ queryKey: ["client-own-automations", user?.id, linkedClient?.id] });
      qc.invalidateQueries({ queryKey: ["client-own-connections", user?.id, linkedClient?.id] });
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.content }]);
    } catch (e: any) {
      toast.error(e.message || "AI error");
    } finally {
      setIsTyping(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (profileLoading || linkedClientLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;

  const activeAutomations = automations.filter((a: any) => a.status === "active").length;
  const connectedApis = connections.filter((c: any) => c.status === "connected").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{profile?.business_name || "My Dashboard"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.business_sector || "Client Portal"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Settings className="h-4 w-4 mr-1" />Settings</Button>
          <Button size="sm" variant="ghost" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Active Automations", value: activeAutomations, icon: "⚡" },
            { title: "Total Automations", value: automations.length, icon: "🔄" },
            { title: "Connected APIs", value: connectedApis, icon: "🔌" },
            { title: "Recent Activity", value: logs.length, icon: "📊" },
          ].map((metric, i) => (
            <motion.div key={metric.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{metric.title}</span>
                    <span className="text-lg">{metric.icon}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <Select value={autoForm.trigger_type} onValueChange={(v) => setAutoForm({ ...autoForm, trigger_type: v })}>
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
                      <Switch checked={auto.status === "active"} onCheckedChange={() => handleToggleAutomation(auto.id, auto.status)} />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                    <div><Label>API Key (optional)</Label><Input type="password" value={connForm.apiKey} onChange={(e) => setConnForm({ ...connForm, apiKey: e.target.value })} placeholder="Paste your key" /></div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Upcoming Events</CardTitle></CardHeader>
            <CardContent>
              {calendarEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming events. Connect Google Calendar to see your schedule.</p>
              ) : (
                <div className="space-y-3">
                  {calendarEvents.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(event.start).toLocaleString()}</p>
                        {event.location && <p className="text-xs text-muted-foreground">{event.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                      <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${log.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <p className="text-sm text-foreground">{log.event}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
{linkedClient && (
  <Card className="bg-card border-border">
    <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
    <CardContent>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleNotesSave}
        placeholder="Add notes about your business..."
        className="min-h-[100px] resize-none"
      />
      <p className="text-xs text-muted-foreground mt-1">Auto-saves when you click away</p>
    </CardContent>
  </Card>
)}
        <Card className={`border ${agencyConnection ? "border-green-500/30 bg-green-500/5" : "bg-card border-border"}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${agencyConnection ? "bg-green-500/20" : "bg-primary/10"}`}>
                <Link className={`h-4 w-4 ${agencyConnection ? "text-green-500" : "text-primary"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {agencyConnection ? "Connected to Agency" : "Agency Connection"}
                </p>
                {agencyConnection ? (
                  <p className="text-xs text-green-500">✓ Connected to {(agencyConnection as any).agencyName}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Connect with your agency or manager to share your data</p>
                )}
              </div>
            </div>
            {!agencyConnection && (
              <Dialog open={connectAgencyOpen} onOpenChange={setConnectAgencyOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">Connect</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Connect with your Agency</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <p className="text-sm text-muted-foreground">Paste the invitation code your agency shared with you.</p>
                    <div><Label>Invitation code</Label><Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Paste your invitation code" /></div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleConnectAgency}>Connect</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">AI Assistant</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div ref={scrollRef} className="h-72 overflow-y-auto p-4 space-y-3">
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
              <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Ask me anything..." className="flex-1" />
              <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Business Profile</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Your name</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div><Label>Business name</Label><Input value={editForm.business_name} onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })} /></div>
            <div><Label>Sector</Label><Input value={editForm.business_sector} onChange={(e) => setEditForm({ ...editForm, business_sector: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={editForm.business_description} onChange={(e) => setEditForm({ ...editForm, business_description: e.target.value })} className="resize-none" rows={3} /></div>
            <div><Label>Website</Label><Input value={editForm.business_website} onChange={(e) => setEditForm({ ...editForm, business_website: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={editForm.business_phone} onChange={(e) => setEditForm({ ...editForm, business_phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleEditSave} disabled={updateProfile.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}