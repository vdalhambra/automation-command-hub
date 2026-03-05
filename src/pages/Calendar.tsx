import { useState } from "react";
import { CalendarDays, ExternalLink, RefreshCw, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarEvents, useGoogleCalendarConnection, useSyncCalendar, CalendarEvent } from "@/hooks/useCalendarEvents";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

function groupByDay(events: CalendarEvent[]) {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const date = e.start.length === 10 ? e.start : e.start.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(e);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMMM d");
}

function formatTime(iso: string) {
  if (iso.length === 10) return "All day";
  return format(parseISO(iso), "h:mm a");
}

export default function Calendar() {
  const connection = useGoogleCalendarConnection();
  const { data: events, isLoading } = useCalendarEvents(!!connection);
  const syncCalendar = useSyncCalendar();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await syncCalendar();
    setSyncing(false);
  };

  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-fade-in">
        <CalendarDays className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Google Calendar not connected</h2>
        <p className="text-sm text-muted-foreground">Connect your Google Calendar to see your upcoming events.</p>
        <Button onClick={() => navigate("/connections")}>
          <Plug className="h-4 w-4 mr-2" />
          Connect Google Calendar
        </Button>
      </div>
    );
  }

  const grouped = groupByDay(events ?? []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Your upcoming Google Calendar events</p>
        </div>
        <div className="text-right space-y-1">
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sync now
          </Button>
          {connection.last_sync && (
            <p className="text-xs text-muted-foreground">
              Last sync: {new Date(connection.last_sync).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No events in the next 7 days</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayEvents]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{dayLabel(date)}</h3>
              <div className="space-y-2">
                {dayEvents.map((ev, i) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="bg-card border-border">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(ev.start)} – {formatTime(ev.end)}
                            {ev.location && ` · ${ev.location}`}
                          </p>
                        </div>
                        {ev.htmlLink && (
                          <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-3 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
