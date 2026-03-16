import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Skip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState({
    business_name: "",
    business_sector: "",
    business_description: "",
    business_website: "",
    business_phone: "",
    full_name: "",
  });

const handleSave = async () => {
    await updateProfile.mutateAsync({ ...form, onboarding_completed: true });

    // Update agency client profile with business data
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("clients")
        .update({
          name: form.business_name || form.full_name,
          industry: form.business_sector,
          description: form.business_description,
          contact_name: form.full_name,
        })
        .eq("linked_user_id", user.id);
    }

    navigate("/client-dashboard");
  };

  const handleSkip = () => {
    navigate("/client-dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tell us about your business</h1>
          <p className="text-muted-foreground mt-1">This helps us personalize your experience. You can skip this and fill it in later.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <Label>Your name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="John Smith"
            />
          </div>
          <div>
            <Label>Business name</Label>
            <Input
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <Label>Sector / Industry</Label>
            <Input
              value={form.business_sector}
              onChange={(e) => setForm({ ...form, business_sector: e.target.value })}
              placeholder="e.g. Healthcare, SaaS, Retail"
            />
          </div>
          <div>
            <Label>What does your business do?</Label>
            <Textarea
              value={form.business_description}
              onChange={(e) => setForm({ ...form, business_description: e.target.value })}
              placeholder="Brief description of your business and main services..."
              className="resize-none"
              rows={3}
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={form.business_website}
              onChange={(e) => setForm({ ...form, business_website: e.target.value })}
              placeholder="https://yourwebsite.com"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.business_phone}
              onChange={(e) => setForm({ ...form, business_phone: e.target.value })}
              placeholder="+34 600 000 000"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={updateProfile.isPending}>
            <ArrowRight className="h-4 w-4 mr-2" />
            {updateProfile.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}