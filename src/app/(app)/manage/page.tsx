"use client";

import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { ShiftCard } from "@/components/shifts/shift-card";
import { mockShifts, mockUsers } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarDays, Clock, AlertCircle, Plus, ArrowRight } from "lucide-react";
import { isToday, isTomorrow, format } from "date-fns";
import Link from "next/link";

export default function ManagePage() {
  const todayShifts = mockShifts.filter(
    (s) => isToday(new Date(s.start_time)) && s.status === "scheduled"
  );
  const tomorrowShifts = mockShifts.filter(
    (s) => isTomorrow(new Date(s.start_time)) && s.status === "scheduled"
  );
  const employeeCount = mockUsers.filter((u) => u.role === "employee").length;

  const totalScheduledHours = mockShifts
    .filter((s) => s.status === "scheduled")
    .reduce((acc, s) => {
      return (
        acc +
        (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) /
          (1000 * 60 * 60)
      );
    }, 0);

  return (
    <div>
      <Header title="Management Overview" />

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Quick actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage shifts, employees, and schedules
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/manage/shifts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Shift
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today's Shifts"
            value={todayShifts.length}
            description={`${tomorrowShifts.length} tomorrow`}
            icon={CalendarDays}
          />
          <StatCard
            title="Active Employees"
            value={employeeCount}
            description="All locations"
            icon={Users}
          />
          <StatCard
            title="Hours Scheduled"
            value={`${Math.round(totalScheduledHours)}h`}
            description="Total upcoming"
            icon={Clock}
          />
          <StatCard
            title="Open Shifts"
            value={0}
            description="All shifts filled"
            icon={AlertCircle}
          />
        </div>

        {/* Today's shifts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Today&apos;s Shifts</CardTitle>
                <Link href="/manage/schedule">
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    View Calendar
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayShifts.length > 0 ? (
                todayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    showEmployee
                    compact
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No shifts today
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tomorrow&apos;s Shifts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tomorrowShifts.length > 0 ? (
                tomorrowShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    showEmployee
                    compact
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No shifts tomorrow
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { time: "2 min ago", text: "Casey Rivera acknowledged shift for tomorrow" },
                { time: "1 hour ago", text: "New shift created: Morning Barista (Main Store)" },
                { time: "3 hours ago", text: "Taylor Kim's Kitchen Prep shift updated" },
                { time: "Yesterday", text: "Sam Chen joined the team" },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0"
                >
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="flex-1">{activity.text}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
