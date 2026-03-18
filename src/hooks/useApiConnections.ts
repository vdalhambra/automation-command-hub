import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ApiConnection {
  id: string;
  user_id: string;
  service: string;
  status: string;
  api_key_encrypted: string | null;
  last_sync: string | null;
  icon: string;
  created_at: string;
}

export function useApiConnections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["api_connections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_connections").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ApiConnection[];
    },
    enabled: !!user,
  });
}

export function useCreateApiConnection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
   mutationFn: async (input: { service: string; api_key_encrypted?: string; api_key_plain?: string; icon?: string }) => {
  const { data, error } = await supabase.from("api_connections").insert({
    service: input.service,
    api_key_encrypted: input.api_key_encrypted || null,
    api_key_plain: input.api_key_plain || null,
    icon: input.icon || "🔗",
    status: "connected",
    last_sync: new Date().toISOString(),
    user_id: user!.id,
  }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api_connections"] }); toast.success("Connection added"); },
    onError: (e) => toast.error(e.message),
  });
}

export function useToggleApiConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "connected" ? "disconnected" : "connected";
      const lastSync = newStatus === "connected" ? new Date().toISOString() : undefined;
      const update: Record<string, unknown> = { status: newStatus };
      if (lastSync) update.last_sync = lastSync;
      const { error } = await supabase.from("api_connections").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api_connections"] }); },
    onError: (e) => toast.error(e.message),
  });
}
export function useDeleteApiConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api_connections"] });
      toast.success("Connection deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}