"use client";

import { Header } from "@/components/layout/header";
import { mockShifts } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftCard } from "@/components/shifts/shift-card";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const shifts = mockShifts.filter((s) => {
    const start = new Date(s.start_time);
    return start >= weekStart && start <= weekEnd;
  });

  const pastShifts = mockShifts
    .filter(
      (s) =>
        s.status === "completed" || s.status === "cancelled" || new Date(s.end_time) < new Date()
    )
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return (
    <div>
      <Header title="My Schedule" />

      <div className="p-6 max-w-5xl">
        <Tabs defaultValue="week">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

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
              <p className="text-sm font-medium min-w-[160px] text-center">
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
          </div>

          <TabsContent value="week">
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
              {/* Day headers */}
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "bg-card p-3 text-center",
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
              {/* Shift cells */}
              {days.map((day) => {
                const dayShifts = shifts.filter((s) =>
                  isSameDay(new Date(s.start_time), day)
                );
                return (
                  <div
                    key={day.toISOString() + "-shifts"}
                    className={cn(
                      "bg-card p-2 min-h-[100px]",
                      isToday(day) && "bg-accent/30"
                    )}
                  >
                    <div className="space-y-1.5">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className={cn(
                            "rounded-md px-2 py-1.5 text-xs border cursor-pointer hover:opacity-80 transition-opacity",
                            shift.status === "scheduled" &&
                              "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                            shift.status === "completed" &&
                              "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                            shift.status === "cancelled" &&
                              "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 line-through"
                          )}
                        >
                          <p className="font-medium truncate">{shift.title}</p>
                          <p className="text-[10px] opacity-70">
                            {format(new Date(shift.start_time), "h:mm a")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-2">
              {shifts.length > 0 ? (
                shifts
                  .sort(
                    (a, b) =>
                      new Date(a.start_time).getTime() -
                      new Date(b.start_time).getTime()
                  )
                  .map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} showEmployee />
                  ))
              ) : (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No shifts this week
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="past">
            <div className="space-y-2">
              {pastShifts.length > 0 ? (
                pastShifts.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} showEmployee />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No past shifts
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
