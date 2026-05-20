import type { Company, Shift, User } from "@prisma/client";

type UserWithCompany = User & { company?: Company | null };

export function serializeUser(user: UserWithCompany) {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    company_id: user.companyId,
    designation: user.designation,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt.toISOString(),
    companies: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          morning_start: user.company.morningStart,
          morning_end: user.company.morningEnd,
          evening_start: user.company.eveningStart,
          evening_end: user.company.eveningEnd,
        }
      : null,
  };
}

export function serializeCompany(company: Company) {
  return {
    id: company.id,
    name: company.name,
    owner_id: company.ownerId,
    morning_start: company.morningStart,
    morning_end: company.morningEnd,
    evening_start: company.eveningStart,
    evening_end: company.eveningEnd,
    created_at: company.createdAt.toISOString(),
  };
}

export function serializeShift(
  shift: Shift & { users?: { fullName: string } | null },
) {
  return {
    id: shift.id,
    company_id: shift.companyId,
    employee_id: shift.employeeId,
    title: shift.title,
    start_time: shift.startTime.toISOString(),
    end_time: shift.endTime.toISOString(),
    created_at: shift.createdAt.toISOString(),
    users: shift.users
      ? { full_name: shift.users.fullName }
      : undefined,
  };
}
