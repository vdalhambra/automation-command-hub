import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description: string;
  trigger_type: string;
  client_id: string | null;
  client_name: string;
  status: string;
  last_run: string | null;
  created_at: string;
}

export function useAutomations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("automations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Automation[];
    },
    enabled: !!user,
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; description: string; trigger_type: string; client_name: string }) => {
      const { data, error } = await supabase.from("automations").insert({ ...input, user_id: user!.id, status: "active" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); toast.success("Automation created"); },
    onError: (e) => toast.error(e.message),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("automations").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); },
    onError: (e) => toast.error(e.message),
  });
}
