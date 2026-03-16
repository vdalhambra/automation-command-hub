import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Command, Building2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"agency" | "client" | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) { toast.error("Please fill in all fields"); return; }
    if (!inviteToken && !selectedRole) { toast.error("Please select your account type"); return; }
    setLoading(true);

    const role = inviteToken ? "client" : selectedRole!;

    // Step 1: Sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (signUpError) { toast.error(signUpError.message); setLoading(false); return; }
    if (!signUpData.user) { toast.error("Signup failed"); setLoading(false); return; }

    // Step 2: Sign in immediately to get valid session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.user) { toast.error("Error signing in after signup"); setLoading(false); return; }
    const user = signInData.user;

    // Step 3: Create profile
    await supabase.from("profiles").upsert({ id: user.id, role, full_name: name });

    // Step 4: Process invite token if present
    if (inviteToken) {
      const { data: invitation, error: invError } = await supabase
        .from("invitations")
        .select("*")
        .eq("token", inviteToken)
        .eq("status", "pending")
        .single();

     console.log("INVITE SEARCH RESULT:", invitation, invError);

if (!invError && invitation) {
  console.log("INVITATION FOUND:", invitation);
  
  const updateRes = await supabase.from("invitations")
    .update({ status: "accepted", accepted_by: user.id })
    .eq("token", inviteToken);
  console.log("INVITATION UPDATE:", updateRes);

  if (invitation.client_id) {
    const clientRes = await supabase.from("clients").update({
      linked_user_id: user.id,
      contact_name: name,
      contact_email: email,
    }).eq("id", invitation.client_id);
    console.log("CLIENT LINK:", clientRes);
  } else {
    const insertRes = await supabase.from("clients").insert({
      user_id: invitation.agency_id,
      name: name,
      industry: "",
      description: "",
      contact_name: name,
      contact_email: email,
      linked_user_id: user.id,
      connected_apis: 0,
      automations: 0,
    });
    console.log("CLIENT INSERT:", insertRes);
  }

  toast.success("Account created and connected to your agency!");
  setLoading(false);
  navigate("/onboarding");
  return;
} else {
  console.log("INVITATION NOT FOUND OR ERROR:", invError);
  toast.error("Invalid or expired invitation link");
  setLoading(false);
  return;
}
    }

    // Step 5: No invite — redirect by role
    setLoading(false);
    toast.success("Account created successfully!");
    if (role === "agency") {
      navigate("/");
    } else {
      navigate("/onboarding");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Command className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            {inviteToken ? "You've been invited to join the platform" : "Get started with Automation Command Center"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            {!inviteToken && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole("agency")}
                  className={`p-3 rounded-lg border text-sm flex flex-col items-center gap-1 transition-all ${selectedRole === "agency" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  <Building2 className="h-5 w-5" />
                  Agency
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("client")}
                  className={`p-3 rounded-lg border text-sm flex flex-col items-center gap-1 transition-all ${selectedRole === "client" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  <User className="h-5 w-5" />
                  Client
                </button>
              </div>
            )}
            {inviteToken && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">
                🔗 You'll be automatically connected to your agency after signup
              </div>
            )}
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating..." : "Create Account"}</Button>
            <div className="text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}