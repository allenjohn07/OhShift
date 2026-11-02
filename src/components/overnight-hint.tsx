import { Moon } from "lucide-react";
import { endsNextDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** "Ends the next day" note under shift times when the end is before the start. */
export function OvernightHint({
  startTime,
  endTime,
  className,
}: {
  startTime: string;
  endTime: string;
  className?: string;
}) {
  if (!endsNextDay(startTime, endTime)) return null;
  if (startTime === endTime) {
    return (
      <p className={cn("text-xs text-destructive", className)}>
        Start and end can&apos;t be the same time
      </p>
    );
  }
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Moon className="h-3.5 w-3.5" />
      Ends the next day (overnight shift)
    </p>
  );
}
