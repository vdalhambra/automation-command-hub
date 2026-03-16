import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useInvitations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["invitations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, clients(name, industry)")
        .eq("agency_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useCreateInvitation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
   mutationFn: async (client_id: string) => {
  const { data, error } = await supabase
    .from("invitations")
    .insert({ agency_id: user!.id, ...(client_id ? { client_id } : {}) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations", user?.id] });
      toast.success("Invitation created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteInvitation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", id)
        .eq("agency_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations", user?.id] });
      toast.success("Invitation deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}