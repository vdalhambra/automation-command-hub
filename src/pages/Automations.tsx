import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { automations as initialAutomations, Automation, clients } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", triggerType: "Webhook", client: "" });

  const filtered = automations.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.client.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = (id: string) => {
    setAutomations((prev) => prev.map((a) =>
      a.id === id ? { ...a, status: a.status === "active" ? "inactive" : "active" } : a
    ));
  };

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const newAutomation: Automation = {
      id: Date.now().toString(), ...form, status: "inactive", lastRun: "Never",
    };
    setAutomations((prev) => [...prev, newAutomation]);
    setDialogOpen(false);
    setForm({ name: "", description: "", triggerType: "Webhook", client: "" });
    toast.success("Automation created");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          <p className="text-sm text-muted-foreground">{automations.filter((a) => a.status === "active").length} active of {automations.length}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Automation</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Automation</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Automation name" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this do?" /></div>
              <div><Label>Trigger Type</Label>
                <Select value={form.triggerType} onValueChange={(v) => setForm({ ...form, triggerType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Webhook">Webhook</SelectItem>
                    <SelectItem value="Schedule">Schedule</SelectItem>
                    <SelectItem value="Event">Event</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Assign to Client</Label>
                <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search automations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filtered.map((auto, i) => (
          <motion.div key={auto.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground text-sm">{auto.name}</h3>
                    <StatusBadge status={auto.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{auto.description}</p>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Trigger: {auto.triggerType}</span>
                    <span>Client: {auto.client}</span>
                    <span>Last run: {auto.lastRun}</span>
                  </div>
                </div>
                <Switch checked={auto.status === "active"} onCheckedChange={() => toggleStatus(auto.id)} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
