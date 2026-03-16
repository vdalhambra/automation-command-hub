import { useNavigate } from "react-router-dom";
import { Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function RoleSelection() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const selectRole = async (role: "agency" | "client") => {
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, role });
    if (error) { toast.error(error.message); return; }
    if (role === "agency") {
      navigate("/dashboard");
    } else {
      navigate("/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome</h1>
          <p className="text-muted-foreground mt-1">How will you use this platform?</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => selectRole("agency")}
            className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-lg">I'm an Agency</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage multiple clients, automate workflows, and track performance across your portfolio.</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => selectRole("client")}
            className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-lg">I'm a Client</h2>
                <p className="text-sm text-muted-foreground mt-1">Access your business dashboard, track your automations, and connect with your agency.</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}