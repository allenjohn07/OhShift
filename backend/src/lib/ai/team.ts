import { asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { companies, users } from "../../db/schema";
import type { ShiftPresets } from "../nl-shift-parse";
import type { TeamMember } from "./types";

/**
 * The people in a company as the assistant may see them. Only these columns are
 * ever selected: no email, password hash, avatar, or invite data.
 */
export async function loadTeam(companyId: string): Promise<TeamMember[]> {
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      designation: users.designation,
    })
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(asc(users.fullName));
  return rows;
}

export async function loadCompanyInfo(
  companyId: string,
): Promise<{ name: string; presets: ShiftPresets }> {
  const [row] = await db
    .select({
      name: companies.name,
      morningStart: companies.morningStart,
      morningEnd: companies.morningEnd,
      eveningStart: companies.eveningStart,
      eveningEnd: companies.eveningEnd,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return {
    name: row?.name ?? "your company",
    presets: {
      morning_start: row?.morningStart || "08:00",
      morning_end: row?.morningEnd || "16:00",
      evening_start: row?.eveningStart || "16:00",
      evening_end: row?.eveningEnd || "00:00",
    },
  };
}
