import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace preferences</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>First Name</Label><Input placeholder="John" /></div>
            <div><Label>Last Name</Label><Input placeholder="Doe" /></div>
          </div>
          <div><Label>Email</Label><Input placeholder="john@example.com" type="email" /></div>
          <Button size="sm" onClick={() => toast.success("Profile saved")}>Save Changes</Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>General workspace settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Workspace Name</Label><Input placeholder="My Agency" /></div>
          <div><Label>Timezone</Label><Input placeholder="UTC-5 (Eastern)" /></div>
          <Button size="sm" onClick={() => toast.success("Workspace updated")}>Update</Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm">Delete Workspace</Button>
        </CardContent>
      </Card>
    </div>
  );
}
