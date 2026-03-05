import { Zap, Plug, Users, Activity, CalendarDays, ExternalLink } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/useClients";
import { useAutomations } from "@/hooks/useAutomations";
import { useApiConnections } from "@/hooks/useApiConnections";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { useCalendarEvents, useGoogleCalendarConnection } from "@/hooks/useCalendarEvents";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";

export default function Dashboard() {
  const { data: clients, isLoading: cl } = useClients();
  const { data: automations, isLoading: al } = useAutomations();
  const { data: connections, isLoading: conl } = useApiConnections();
  const { data: logs, isLoading: ll } = useActivityLogs();

  const calendarConnection = useGoogleCalendarConnection();
  const { data: calendarEvents } = useCalendarEvents(!!calendarConnection);
  const navigate = useNavigate();

  const activeAutomations = automations?.filter((a) => a.status === "active").length ?? 0;
  const connectedApis = connections?.filter((c) => c.status === "connected").length ?? 0;
  const totalClients = clients?.length ?? 0;
  const recentLogs = logs?.slice(0, 6) ?? [];
  const upcomingEvents = (calendarEvents ?? []).slice(0, 3);

  const loading = cl || al || conl || ll;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your automation command center</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Automations" value={activeAutomations} icon={Zap} description="currently running" />
          <MetricCard title="Connected APIs" value={connectedApis} icon={Plug} description="services linked" />
          <MetricCard title="Total Clients" value={totalClients} icon={Users} description="across all workspaces" />
          <MetricCard title="Events Logged" value={logs?.length ?? 0} icon={Activity} description="total events" />
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Upcoming Events</CardTitle>
          {calendarConnection && <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>View all</Button>}
        </CardHeader>
        <CardContent>
          {!calendarConnection ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-muted-foreground">Google Calendar not connected</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/connections")}>Connect Google Calendar</Button>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.start.length === 10 ? format(parseISO(ev.start), "MMM d") : format(parseISO(ev.start), "MMM d, h:mm a")}
                      {ev.location && ` · ${ev.location}`}
                    </p>
                  </div>
                  {ev.htmlLink && (
                    <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{log.event}</p>
                    <p className="text-xs text-muted-foreground">{log.client_name} · {new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <StatusBadge status={log.status as "success" | "error" | "pending"} />
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
