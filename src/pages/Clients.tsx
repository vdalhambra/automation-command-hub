import { useState } from "react";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Link } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, Client } from "@/hooks/useClients";
import { useCreateInvitation } from "@/hooks/useInvitations";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createInvitation = useCreateInvitation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", industry: "", description: "" });
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [openInviteDialogOpen, setOpenInviteDialogOpen] = useState(false);
  const [openInviteLink, setOpenInviteLink] = useState("");

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      updateClient.mutate({ id: editing.id, ...form });
    } else {
      createClient.mutate(form);
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", industry: "", description: "" });
  };

  const handleEdit = (client: Client) => {
    setEditing(client);
    setForm({ name: client.name, industry: client.industry, description: client.description });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteClient.mutate(id);
  };

  const handleGenerateInvite = async (clientId: string) => {
    const inv = await createInvitation.mutateAsync(clientId);
    const link = `${window.location.origin}/signup?invite=${inv.token}`;
    setInviteLink(link);
    setInviteDialogOpen(true);
  };

  const handleGenerateOpenInvite = async () => {
    const inv = await createInvitation.mutateAsync("");
    const link = `${window.location.origin}/signup?invite=${inv.token}`;
    setOpenInviteLink(link);
    setOpenInviteDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clients managed</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerateOpenInvite}>
            <Link className="h-4 w-4 mr-1" /> Invite through link
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Client
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client, i) => (
            <motion.div key={client.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{client.name}</h3>
                      <p className="text-xs text-muted-foreground">{client.industry}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(client); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleGenerateInvite(client.id); }}>
                          <Link className="h-3.5 w-3.5 mr-2" />Invite Client
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{client.description}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{client.connected_apis}</strong> APIs</span>
                    <span><strong className="text-foreground">{client.automations}</strong> Automations</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ name: "", industry: "", description: "" }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Client</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Client name" /></div>
            <div><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. SaaS, Marketing" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite existing client dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Client Invitation Link</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Share this link with your client. They will be automatically connected to your agency when they sign up.</p>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="text-xs" />
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copied!"); }}>Copy</Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open invite dialog */}
      <Dialog open={openInviteDialogOpen} onOpenChange={setOpenInviteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite New Client</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Share this link with your new client. When they sign up, they will automatically appear in your clients list with their business information.</p>
            <div className="flex gap-2">
              <Input value={openInviteLink} readOnly className="text-xs" />
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(openInviteLink); toast.success("Copied!"); }}>Copy</Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}