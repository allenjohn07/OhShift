"use client";

import { Header } from "@/components/layout/header";
import { mockShifts, mockUsers } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
} from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function ManageSchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const employees = mockUsers.filter((u) => u.role === "employee");

  return (
    <div>
      <Header title="Team Schedule" />

      <div className="p-6 space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs px-3 h-8"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <p className="text-sm font-medium min-w-[200px] text-center">
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            </p>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Link href="/manage/shifts/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Shift
            </Button>
          </Link>
        </div>

        {/* Calendar grid */}
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[180px_repeat(7,1fr)] bg-muted/30">
            <div className="p-3 border-r border-border text-xs font-medium text-muted-foreground">
              Employee
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-3 text-center border-r border-border last:border-r-0",
                  isToday(day) && "bg-accent"
                )}
              >
                <p className="text-xs text-muted-foreground font-medium">
                  {format(day, "EEE")}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold mt-0.5",
                    isToday(day) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="grid grid-cols-[180px_repeat(7,1fr)] border-t border-border"
            >
              {/* Employee name */}
              <div className="p-3 border-r border-border flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                  {employee.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <span className="text-sm font-medium truncate">
                  {employee.full_name}
                </span>
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const dayShifts = mockShifts.filter(
                  (s) =>
                    s.employee_id === employee.id &&
                    isSameDay(new Date(s.start_time), day) &&
                    s.status !== "cancelled"
                );

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "p-1.5 border-r border-border last:border-r-0 min-h-[72px]",
                      isToday(day) && "bg-accent/20"
                    )}
                  >
                    {dayShifts.map((shift) => (
                      <Link
                        href={`/manage/shifts/${shift.id}/edit`}
                        key={shift.id}
                      >
                        <div className="rounded-md px-2 py-1.5 text-xs bg-primary/10 border border-primary/20 text-foreground cursor-pointer hover:bg-primary/15 transition-colors mb-1">
                          <p className="font-medium truncate">{shift.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(shift.start_time), "h:mm a")} –{" "}
                            {format(new Date(shift.end_time), "h:mm a")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
