import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "inactive" | "connected" | "disconnected" | "success" | "error" | "pending";
}

const statusStyles: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  connected: "bg-success/10 text-success border-success/20",
  success: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  disconnected: "bg-destructive/10 text-destructive border-destructive/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-warning/10 text-warning border-warning/20",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", statusStyles[status])}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current inline-block" />
      {status}
    </Badge>
  );
}
