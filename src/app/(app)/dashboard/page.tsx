"use client";

import { Header } from "@/components/layout/header";
import { ShiftCard } from "@/components/shifts/shift-card";
import { StatCard } from "@/components/ui/stat-card";
import { mockShifts, mockCurrentUser, getUpcomingShifts } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import { format, isToday, isTomorrow, startOfWeek, endOfWeek } from "date-fns";

export default function DashboardPage() {
  // For demo, show all upcoming shifts (as if current user is employee)
  const upcomingShifts = mockShifts
    .filter((s) => s.status === "scheduled" && new Date(s.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const nextShift = upcomingShifts[0];
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const thisWeekShifts = mockShifts.filter((s) => {
    const start = new Date(s.start_time);
    return start >= weekStart && start <= weekEnd && s.status === "scheduled";
  });

  const totalHoursThisWeek = thisWeekShifts.reduce((acc, s) => {
    const hours =
      (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) /
      (1000 * 60 * 60);
    return acc + hours;
  }, 0);

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, {mockCurrentUser.full_name.split(" ")[0]}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Here&apos;s what&apos;s happening with your schedule
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Upcoming Shifts"
            value={upcomingShifts.length}
            description="Next 7 days"
            icon={CalendarDays}
          />
          <StatCard
            title="Hours This Week"
            value={`${totalHoursThisWeek}h`}
            description={`${thisWeekShifts.length} shifts`}
            icon={Clock}
          />
          <StatCard
            title="Team Coverage"
            value="94%"
            description="All positions filled"
            icon={TrendingUp}
            trend={{ value: "+2% vs last week", positive: true }}
          />
          <StatCard
            title="Acknowledged"
            value="12/14"
            description="Shifts confirmed"
            icon={CheckCircle2}
          />
        </div>

        {/* Next shift highlight */}
        {nextShift && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Your Next Shift</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {isToday(new Date(nextShift.start_time))
                    ? "Today"
                    : isTomorrow(new Date(nextShift.start_time))
                      ? "Tomorrow"
                      : format(new Date(nextShift.start_time), "EEEE")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ShiftCard shift={nextShift} compact />
            </CardContent>
          </Card>
        )}

        {/* Recent upcoming */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Upcoming Shifts
          </h3>
          <div className="space-y-2">
            {upcomingShifts.slice(1, 6).map((shift) => (
              <ShiftCard key={shift.id} shift={shift} showEmployee />
            ))}
          </div>
          {upcomingShifts.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No upcoming shifts scheduled
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
