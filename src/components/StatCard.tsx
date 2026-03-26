import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ title, value, change, icon: Icon, iconColor }: StatCardProps) {
  const isPositive = change >= 0;
  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold font-display tracking-tight">{value}</p>
          <div className={cn("flex items-center gap-1 text-xs font-medium", isPositive ? "text-success" : "text-destructive")}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(change)}%</span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", iconColor || "bg-primary/10")}>
          <Icon className={cn("h-5 w-5", iconColor ? "text-primary-foreground" : "text-primary")} />
        </div>
      </div>
    </div>
  );
}
