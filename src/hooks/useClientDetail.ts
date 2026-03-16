import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useClientDetail(clientId: string) {
  return useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useUpdateClientDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: any) => {
      const { error } = await supabase
        .from("clients")
        .update(input)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["client", variables.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useClientAutomations(clientId: string) {
  return useQuery({
    queryKey: ["client-automations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });
}

export function useClientApiConnections(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-connections", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_api_connections")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId && !!user,
  });
}

export function useCreateClientApiConnection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { client_id: string; service: string; api_key_encrypted?: string; icon?: string }) => {
      const { data, error } = await supabase
        .from("client_api_connections")
        .insert({ ...input, user_id: user!.id, status: "connected", last_sync: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["client-connections", variables.client_id] });
      toast.success("Connection added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useClientActivityLogs(clientId: string) {
  return useQuery({
    queryKey: ["client-logs", clientId],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();
      if (!client) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("client_name", client.name)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });
}

export function useToggleClientAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, clientId }: { id: string; status: string; clientId: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("automations")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return { clientId };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["client-automations", variables.clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}