import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActivityLog {
  id: string;
  user_id: string;
  event: string;
  client_name: string;
  status: string;
  type: string;
  created_at: string;
}

export function useActivityLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["activity_logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!user,
  });
}
