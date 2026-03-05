import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Command } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    // Mock login — will be replaced with real auth
    localStorage.setItem("acc-auth", "true");
    toast.success("Welcome back!");
    navigate("/");
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
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            <Button type="submit" className="w-full">Sign In</Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
