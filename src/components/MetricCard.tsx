import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: string;
}

export function MetricCard({ title, value, description, icon: Icon, trend }: MetricCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="bg-card border-border hover:border-primary/30 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">{title}</span>
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground">{value}</div>
          {(description || trend) && (
            <p className="text-xs text-muted-foreground mt-1">
              {trend && <span className="text-success">{trend}</span>} {description}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
