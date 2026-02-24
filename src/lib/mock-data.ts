import { Company, User, Shift, Notification } from "./types";
import { addDays, setHours, setMinutes, subDays, format } from "date-fns";

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const mockCompany: Company = {
  id: "comp-001",
  name: "Brew & Co.",
  slug: "brew-and-co",
  owner_id: "user-001",
  timezone: "America/New_York",
  created_at: "2025-01-15T10:00:00Z",
};

export const mockUsers: User[] = [
  {
    id: "user-001",
    email: "alex@brewco.com",
    full_name: "Alex Morgan",
    avatar_url: undefined,
    company_id: "comp-001",
    role: "owner",
    phone: "+1 555-0100",
  },
  {
    id: "user-002",
    email: "jordan@brewco.com",
    full_name: "Jordan Lee",
    avatar_url: undefined,
    company_id: "comp-001",
    role: "manager",
    phone: "+1 555-0101",
  },
  {
    id: "user-003",
    email: "casey@brewco.com",
    full_name: "Casey Rivera",
    avatar_url: undefined,
    company_id: "comp-001",
    role: "employee",
  },
  {
    id: "user-004",
    email: "taylor@brewco.com",
    full_name: "Taylor Kim",
    avatar_url: undefined,
    company_id: "comp-001",
    role: "employee",
  },
  {
    id: "user-005",
    email: "sam@brewco.com",
    full_name: "Sam Chen",
    avatar_url: undefined,
    company_id: "comp-001",
    role: "employee",
    phone: "+1 555-0104",
  },
  {
    id: "user-006",
    email: "avery@brewco.com",
    full_name: "Avery Patel",
    avatar_url: undefined,
    company_id: "comp-001",
    role: "employee",
  },
];

export const mockCurrentUser = mockUsers[0];

function makeShift(
  id: string,
  employeeId: string,
  title: string,
  dayOffset: number,
  startHour: number,
  endHour: number,
  status: "scheduled" | "completed" | "cancelled" = "scheduled",
  location?: string,
  notes?: string
): Shift {
  const day = addDays(today, dayOffset);
  return {
    id,
    company_id: "comp-001",
    employee_id: employeeId,
    employee: mockUsers.find((u) => u.id === employeeId),
    title,
    location: location || "Main Store",
    start_time: setMinutes(setHours(day, startHour), 0).toISOString(),
    end_time: setMinutes(setHours(day, endHour), 0).toISOString(),
    status,
    notes,
    created_by: "user-001",
    created_at: subDays(now, 7).toISOString(),
  };
}

export const mockShifts: Shift[] = [
  // Today
  makeShift("shift-001", "user-003", "Morning Barista", 0, 7, 15, "scheduled", "Main Store", "Open the store and prep espresso machines"),
  makeShift("shift-002", "user-004", "Afternoon Barista", 0, 14, 22, "scheduled", "Main Store"),
  makeShift("shift-003", "user-005", "Kitchen Prep", 0, 8, 16, "scheduled", "Main Store", "Check inventory on arrival"),
  // Tomorrow
  makeShift("shift-004", "user-006", "Morning Barista", 1, 7, 15, "scheduled", "Downtown"),
  makeShift("shift-005", "user-003", "Afternoon Barista", 1, 14, 22, "scheduled", "Downtown"),
  makeShift("shift-006", "user-004", "Kitchen Prep", 1, 9, 17, "scheduled", "Main Store"),
  // Day after tomorrow
  makeShift("shift-007", "user-005", "Morning Barista", 2, 6, 14, "scheduled", "Main Store"),
  makeShift("shift-008", "user-006", "Afternoon Barista", 2, 13, 21, "scheduled", "Downtown"),
  // Day 3
  makeShift("shift-009", "user-003", "Full Day", 3, 8, 18, "scheduled", "Main Store", "Team training session — arrive 15 min early"),
  makeShift("shift-010", "user-004", "Morning Barista", 3, 7, 15, "scheduled", "Downtown"),
  // Day 4
  makeShift("shift-011", "user-005", "Closer", 4, 16, 23, "scheduled", "Main Store"),
  makeShift("shift-012", "user-006", "Morning Barista", 4, 7, 15, "scheduled", "Main Store"),
  // Past shifts
  makeShift("shift-013", "user-003", "Morning Barista", -1, 7, 15, "completed", "Main Store"),
  makeShift("shift-014", "user-004", "Afternoon Barista", -1, 14, 22, "completed", "Downtown"),
  makeShift("shift-015", "user-005", "Kitchen Prep", -2, 8, 16, "cancelled", "Main Store", "Cancelled due to low traffic"),
];

export const mockNotifications: Notification[] = [
  {
    id: "notif-001",
    user_id: "user-003",
    title: "New Shift Assigned",
    message: `You have been assigned "Morning Barista" on ${format(addDays(today, 0), "MMM d")}`,
    type: "shift_assigned",
    read: false,
    shift_id: "shift-001",
    created_at: subDays(now, 1).toISOString(),
  },
  {
    id: "notif-002",
    user_id: "user-003",
    title: "Shift Updated",
    message: `Your shift on ${format(addDays(today, 3), "MMM d")} has been updated to start at 8 AM`,
    type: "shift_updated",
    read: false,
    shift_id: "shift-009",
    created_at: subDays(now, 0).toISOString(),
  },
  {
    id: "notif-003",
    user_id: "user-005",
    title: "Shift Cancelled",
    message: "Your Kitchen Prep shift has been cancelled",
    type: "shift_cancelled",
    read: true,
    shift_id: "shift-015",
    created_at: subDays(now, 2).toISOString(),
  },
  {
    id: "notif-004",
    user_id: "user-003",
    title: "Shift Reminder",
    message: `Reminder: "Full Day" shift tomorrow at 8:00 AM`,
    type: "reminder",
    read: false,
    shift_id: "shift-009",
    created_at: now.toISOString(),
  },
];

export function getUpcomingShifts(userId: string): Shift[] {
  return mockShifts
    .filter(
      (s) =>
        s.employee_id === userId &&
        s.status === "scheduled" &&
        new Date(s.start_time) >= now
    )
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
}

export function getEmployeeShiftCount(userId: string): number {
  return mockShifts.filter(
    (s) =>
      s.employee_id === userId &&
      s.status === "scheduled" &&
      new Date(s.start_time) >= now
  ).length;
}
