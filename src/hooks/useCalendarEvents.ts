import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApiConnections } from "@/hooks/useApiConnections";
import { toast } from "sonner";
import { useCallback } from "react";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
  htmlLink: string | null;
}

export function useGoogleCalendarConnection() {
  const { data: connections } = useApiConnections();
  const conn = connections?.find(
    (c) => c.service === "Google Calendar" && c.status === "connected"
  );
  return conn ?? null;
}

export function useCalendarEvents(enabled = true) {
  const { user } = useAuth();
  const connection = useGoogleCalendarConnection();

  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await supabase.functions.invoke("google-calendar-sync", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { days: 7 },
      });
      if (res.error) throw new Error(res.error.message);
      return (res.data?.events ?? []) as CalendarEvent[];
    },
    enabled: !!user && !!connection && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyncCalendar() {
  const qc = useQueryClient();
  return useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await supabase.functions.invoke("google-calendar-sync", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { days: 7 },
      });
      if (res.error) throw res.error;
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["api_connections"] });
      toast.success("Calendar synced");
      return res.data?.events as CalendarEvent[];
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
      return [];
    }
  }, [qc]);
}
