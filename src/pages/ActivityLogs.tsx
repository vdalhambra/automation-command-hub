import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { motion } from "framer-motion";

type FilterType = "all" | "automation" | "api" | "system";

export default function ActivityLogs() {
  const { data: logs = [], isLoading } = useActivityLogs();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = logs.filter((log) => {
    const matchesSearch = log.event.toLowerCase().includes(search.toLowerCase()) || log.client_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || log.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">{logs.length} events recorded</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(["all", "automation", "api", "system"] as FilterType[]).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No activity logs yet</p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between px-5 py-3.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{log.event}</p>
                      <p className="text-xs text-muted-foreground">{log.client_name} · {new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground capitalize hidden sm:inline">{log.type}</span>
                      <StatusBadge status={log.status as "success" | "error" | "pending"} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
