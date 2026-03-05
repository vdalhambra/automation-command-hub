import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiConnections as initialConnections, ApiConnection } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { toast } from "sonner";

const serviceOptions = ["Google Calendar", "Meta Ads", "Retell AI", "Slack Webhook", "Custom API", "Stripe", "HubSpot"];

export default function ApiConnections() {
  const [connections, setConnections] = useState<ApiConnection[]>(initialConnections);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ service: "", apiKey: "" });

  const filtered = connections.filter((c) => c.service.toLowerCase().includes(search.toLowerCase()));

  const handleConnect = () => {
    if (!form.service) { toast.error("Select a service"); return; }
    const newConn: ApiConnection = {
      id: Date.now().toString(), service: form.service, status: "connected", lastSync: "Just now", icon: "🔗",
    };
    setConnections((prev) => [...prev, newConn]);
    setDialogOpen(false);
    setForm({ service: "", apiKey: "" });
    toast.success(`${form.service} connected`);
  };

  const toggleConnection = (id: string) => {
    setConnections((prev) => prev.map((c) =>
      c.id === id ? { ...c, status: c.status === "connected" ? "disconnected" : "connected" } : c
    ));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Connections</h1>
          <p className="text-sm text-muted-foreground">{connections.filter((c) => c.status === "connected").length} services connected</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Connection</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Connect Service</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Service</Label>
                <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>{serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>API Key / Token</Label><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Paste your key" /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleConnect}>Connect</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search connections..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((conn, i) => (
          <motion.div key={conn.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{conn.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{conn.service}</h3>
                      <p className="text-xs text-muted-foreground">Last sync: {conn.lastSync}</p>
                    </div>
                  </div>
                  <StatusBadge status={conn.status} />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => toggleConnection(conn.id)}>
                  {conn.status === "connected" ? "Disconnect" : "Reconnect"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
