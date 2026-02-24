export type Role = "owner" | "manager" | "employee";
export type ShiftStatus = "scheduled" | "completed" | "cancelled";

export interface Company {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  timezone: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  company_id: string;
  role: Role;
  phone?: string;
}

export interface Shift {
  id: string;
  company_id: string;
  employee_id: string | null;
  employee?: User;
  title: string;
  location?: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface ShiftAcknowledgement {
  id: string;
  shift_id: string;
  employee_id: string;
  acknowledged_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "shift_assigned" | "shift_updated" | "shift_cancelled" | "reminder";
  read: boolean;
  shift_id?: string;
  created_at: string;
}
