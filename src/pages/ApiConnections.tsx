import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiConnections, useCreateApiConnection, useToggleApiConnection } from "@/hooks/useApiConnections";
import { useGoogleOAuthRedirect, useGoogleOAuthCallback } from "@/hooks/useGoogleOAuth";
import { motion } from "framer-motion";

const serviceOptions = ["Google Calendar", "Meta Ads", "Retell AI", "Slack Webhook", "Custom API"];
const serviceIcons: Record<string, string> = {
  "Google Calendar": "📅", "Meta Ads": "📢", "Retell AI": "🤖", "Slack Webhook": "💬", "Custom API": "🔗",
};

export default function ApiConnections() {
  const { data: connections = [], isLoading } = useApiConnections();
  const createConnection = useCreateApiConnection();
  const toggleConnection = useToggleApiConnection();
  const startGoogleOAuth = useGoogleOAuthRedirect();
  useGoogleOAuthCallback();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ service: "", apiKey: "" });

  const filtered = connections.filter((c) =>
    c.service.toLowerCase().includes(search.toLowerCase())
  );

  const connectedCount = connections.filter((c) => c.status === "connected").length;

  const handleConnect = () => {
    if (!form.service) return;
    createConnection.mutate({
      service: form.service,
      api_key_encrypted: form.apiKey || undefined,
      icon: serviceIcons[form.service] || "🔗",
    });
    setDialogOpen(false);
    setForm({ service: "", apiKey: "" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Connections</h1>
          <p className="text-sm text-muted-foreground">{connectedCount} services connected</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Connection</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add API Connection</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Service</Label>
                <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.service === "Google Calendar" ? (
                <Button className="w-full" onClick={() => { setDialogOpen(false); startGoogleOAuth(); }}>
                  📅 Connect with Google
                </Button>
              ) : (
                <>
                  <div><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Enter API key" /></div>
                </>
              )}
            </div>
            {form.service !== "Google Calendar" && (
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleConnect}>Connect</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search connections..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((conn, i) => (
            <motion.div key={conn.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{conn.icon}</span>
                      <div>
                        <h3 className="font-semibold text-foreground">{conn.service}</h3>
                        <p className="text-xs text-muted-foreground">
                          {conn.last_sync ? `Last sync: ${new Date(conn.last_sync).toLocaleString()}` : "Never synced"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={conn.status === "connected" ? "success" : "error"} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => toggleConnection.mutate({ id: conn.id, status: conn.status })}
                  >
                    {conn.status === "connected" ? "Disconnect" : "Reconnect"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
