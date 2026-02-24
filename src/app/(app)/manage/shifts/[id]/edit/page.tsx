"use client";

import { Header } from "@/components/layout/header";
import { mockShifts, mockUsers } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, string> = {
  scheduled: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const shift = mockShifts.find((s) => s.id === id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const employees = mockUsers.filter((u) => u.role === "employee");

  if (!shift) {
    return (
      <div>
        <Header title="Edit Shift" />
        <div className="p-6 text-center py-20">
          <p className="text-muted-foreground">Shift not found</p>
          <Link href="/manage">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Shift updated successfully");
    }, 500);
  };

  const handleCancel = () => {
    toast.success("Shift cancelled");
  };

  return (
    <div>
      <Header title="Edit Shift" />

      <div className="p-6 max-w-2xl">
        <Link
          href="/manage/schedule"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to schedule
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Edit Shift</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2 py-0.5 border capitalize",
                  statusVariant[shift.status]
                )}
              >
                {shift.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Shift Title</Label>
                <Input id="title" defaultValue={shift.title} required />
              </div>

              <div className="space-y-2">
                <Label>Assign Employee</Label>
                <Select defaultValue={shift.employee_id || "unassigned"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      Leave Unassigned (Open Shift)
                    </SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    defaultValue={format(new Date(shift.start_time), "yyyy-MM-dd")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start">Start Time</Label>
                  <Input
                    id="start"
                    type="time"
                    defaultValue={format(new Date(shift.start_time), "HH:mm")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Time</Label>
                  <Input
                    id="end"
                    type="time"
                    defaultValue={format(new Date(shift.end_time), "HH:mm")}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  defaultValue={shift.location || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  defaultValue={shift.notes || ""}
                  rows={3}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleCancel}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel Shift
                </Button>
                <div className="flex gap-3">
                  <Link href="/manage/schedule">
                    <Button variant="outline" type="button">
                      Discard
                    </Button>
                  </Link>
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
