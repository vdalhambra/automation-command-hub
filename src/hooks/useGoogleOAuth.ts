import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const REDIRECT_URI = window.location.origin + "/connections";

export function useGoogleOAuthRedirect() {
  return async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await supabase.functions.invoke("google-calendar-auth", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { action: "get-auth-url", redirect_uri: REDIRECT_URI },
      });
      if (res.error) throw res.error;
      window.location.href = res.data.url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start Google OAuth");
    }
  };
}

export function useGoogleOAuthCallback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;

    const exchange = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const res = await supabase.functions.invoke("google-calendar-auth", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: { action: "exchange-code", code, redirect_uri: REDIRECT_URI },
        });
        if (res.error) throw res.error;
        toast.success("Google Calendar connected!");
        qc.invalidateQueries({ queryKey: ["api_connections"] });
      } catch (e: any) {
        toast.error(e.message || "Failed to connect Google Calendar");
      } finally {
        // Remove code from URL
        searchParams.delete("code");
        searchParams.delete("scope");
        setSearchParams(searchParams, { replace: true });
      }
    };

    exchange();
  }, [searchParams, setSearchParams, qc]);
}
