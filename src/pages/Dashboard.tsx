import { Zap, Plug, Users, Activity } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { activityLogs } from "@/lib/mock-data";
import { motion } from "framer-motion";

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your automation command center</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Automations" value={4} icon={Zap} trend="+2" description="this week" />
        <MetricCard title="Connected APIs" value={4} icon={Plug} trend="+1" description="this month" />
        <MetricCard title="Total Clients" value={4} icon={Users} description="across all workspaces" />
        <MetricCard title="Events Today" value={23} icon={Activity} trend="+12%" description="vs yesterday" />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activityLogs.slice(0, 6).map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{log.event}</p>
                  <p className="text-xs text-muted-foreground">{log.client} · {log.timestamp}</p>
                </div>
                <StatusBadge status={log.status} />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
