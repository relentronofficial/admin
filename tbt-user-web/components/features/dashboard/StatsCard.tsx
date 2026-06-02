import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: boolean;
}

export function StatsCard({ label, value, icon: Icon, trend, accent = false }: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 flex flex-col gap-3",
        accent
          ? "bg-brand-600 border-brand-600 text-white"
          : "bg-card border-border"
      )}
    >
      <div className="flex items-start justify-between">
        <p className={cn("text-xs font-semibold uppercase tracking-wider", accent ? "text-white/70" : "text-muted-foreground")}>
          {label}
        </p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", accent ? "bg-white/20" : "bg-muted")}>
          <Icon size={16} className={accent ? "text-white" : "text-muted-foreground"} />
        </div>
      </div>

      <p className={cn("text-3xl font-black tracking-tight", accent ? "text-white" : "text-foreground")}>
        {value}
      </p>

      {trend && (
        <p className={cn("text-xs font-medium", trend.positive ? (accent ? "text-white/80" : "text-emerald-600") : "text-rose-500")}>
          {trend.positive ? "+" : ""}{trend.value} from last month
        </p>
      )}
    </div>
  );
}
