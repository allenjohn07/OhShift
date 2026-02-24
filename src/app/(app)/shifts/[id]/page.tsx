"use client";

import { Header } from "@/components/layout/header";
import { mockShifts } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, FileText, CheckCircle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { use } from "react";

const statusVariant: Record<string, string> = {
  scheduled: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const shift = mockShifts.find((s) => s.id === id);

  if (!shift) {
    return (
      <div>
        <Header title="Shift Detail" />
        <div className="p-6 text-center py-20">
          <p className="text-muted-foreground">Shift not found</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  return (
    <div>
      <Header title="Shift Detail" />

      <div className="p-6 max-w-2xl">
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to schedule
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">{shift.title}</CardTitle>
                {shift.employee && (
                  <p className="text-sm text-muted-foreground">
                    Assigned to {shift.employee.full_name}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2 py-0.5 border",
                  statusVariant[shift.status]
                )}
              >
                {shift.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Time */}
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent shrink-0">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {format(start, "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(start, "h:mm a")} — {format(end, "h:mm a")} ({hours} hours)
                </p>
              </div>
            </div>

            {/* Location */}
            {shift.location && (
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent shrink-0">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{shift.location}</p>
                </div>
              </div>
            )}

            {/* Notes */}
            {shift.notes && (
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground">{shift.notes}</p>
                </div>
              </div>
            )}

            {/* Acknowledge button */}
            {shift.status === "scheduled" && (
              <div className="pt-4 border-t border-border">
                <Button className="w-full">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Acknowledge Shift
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Let your manager know you&apos;ve seen this shift
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
