"use client";

import { Shift } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

const statusVariant: Record<string, string> = {
  scheduled: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ShiftCard({
  shift,
  showEmployee = false,
  compact = false,
}: {
  shift: Shift;
  showEmployee?: boolean;
  compact?: boolean;
}) {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  return (
    <Link href={`/shifts/${shift.id}`}>
      <Card
        className={cn(
          "hover:border-foreground/20 transition-all cursor-pointer group",
          compact && "border-0 shadow-none bg-transparent"
        )}
      >
        <CardContent className={cn("p-4", compact && "p-2 px-0")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{shift.title}</h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-5 border shrink-0",
                    statusVariant[shift.status]
                  )}
                >
                  {shift.status}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(start, "h:mm a")} — {format(end, "h:mm a")}
                </span>
                <span className="text-muted-foreground/50">·</span>
                <span>{hours}h</span>
              </div>

              {shift.location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {shift.location}
                </p>
              )}

              {showEmployee && shift.employee && (
                <p className="text-xs text-muted-foreground">
                  {shift.employee.full_name}
                </p>
              )}

              {!compact && shift.notes && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{shift.notes}</span>
                </p>
              )}
            </div>

            {!compact && (
              <div className="text-right shrink-0">
                <p className="text-sm font-medium tabular-nums">
                  {format(start, "MMM d")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(start, "EEEE")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
