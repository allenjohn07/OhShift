import { and, asc, eq, inArray, or } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { db } from "../db";
import { companies, users } from "../db/schema";
import { ApiError, readJson, requireManager } from "../lib/auth-guard";
import { askSchedule } from "../lib/nl-schedule-ask";
import { parseShiftFromPrompt } from "../lib/nl-shift-parse";

async function loadRosterAndPresets(user: {
  id: string;
  companyId: string;
  fullName: string;
  designation: string | null;
}) {
  const [rosterRows, companyRows] = await db.batch([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        designation: users.designation,
      })
      .from(users)
      .where(
        and(
          eq(users.companyId, user.companyId),
          or(inArray(users.role, ["employee", "manager"]), eq(users.id, user.id)),
        ),
      )
      .orderBy(asc(users.fullName)),
    db
      .select({
        morningStart: companies.morningStart,
        morningEnd: companies.morningEnd,
        eveningStart: companies.eveningStart,
        eveningEnd: companies.eveningEnd,
      })
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1),
  ]);
  const company = companyRows[0];

  const roster = rosterRows.map((row) => ({
    id: row.id,
    full_name: row.fullName,
    designation: row.designation,
  }));

  const selfRow =
    roster.find((m) => m.id === user.id) ??
    ({
      id: user.id,
      full_name: user.fullName,
      designation: user.designation ?? null,
    } as const);

  if (!roster.some((m) => m.id === selfRow.id)) {
    roster.push(selfRow);
  }

  const presets = {
    morning_start: company?.morningStart || "08:00",
    morning_end: company?.morningEnd || "16:00",
    evening_start: company?.eveningStart || "16:00",
    evening_end: company?.eveningEnd || "23:00",
  };

  return { roster, selfRow, presets };
}

function aiErrorStatus(message: string): number {
  const isConfig =
    message.includes("not configured") ||
    message.includes("Workers AI") ||
    message.includes("quota") ||
    message.includes("rate limit");
  return isConfig ? 503 : 500;
}

/** Shared prompt/timezone parsing for both AI endpoints. */
async function readPrompt(c: Context) {
  const { prompt, timezone, employeeId } = await readJson<{
    prompt: string;
    timezone: string;
    employeeId: string;
  }>(c);

  const trimmed = typeof prompt === "string" ? prompt.trim() : "";
  if (!trimmed) {
    throw new ApiError("Prompt is required", 400);
  }
  if (trimmed.length > 500) {
    throw new ApiError("Prompt is too long", 400);
  }

  const tz =
    typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC";
  return { prompt: trimmed, timezone: tz, employeeId };
}

function aiFailure(c: Context, err: unknown, fallback: string) {
  if (err instanceof ApiError) throw err;
  console.error(err);
  const message = err instanceof Error ? err.message : fallback;
  return c.json({ error: message }, aiErrorStatus(message) as 500);
}

export const aiRoutes = new Hono()
  .post("/parse-shift", async (c) => {
    const user = await requireManager(c);
    const { prompt, timezone, employeeId } = await readPrompt(c);

    try {
      const { roster, selfRow, presets } = await loadRosterAndPresets(user);

      const result = await parseShiftFromPrompt({
        prompt,
        timezone,
        roster,
        self: selfRow,
        presets,
        lockEmployeeId:
          typeof employeeId === "string" && employeeId.trim()
            ? employeeId.trim()
            : null,
      });

      if ("employee_id" in result) {
        return c.json({ proposal: result });
      }
      return c.json({ error: result.error }, 422);
    } catch (err) {
      return aiFailure(c, err, "Failed to parse shift request");
    }
  })
  .post("/ask", async (c) => {
    const user = await requireManager(c);
    const { prompt, timezone } = await readPrompt(c);

    try {
      const { roster, selfRow, presets } = await loadRosterAndPresets(user);

      const result = await askSchedule({
        prompt,
        companyId: user.companyId,
        timezone,
        roster,
        self: selfRow,
        presets,
      });

      if ("kind" in result) {
        if (result.kind === "create") {
          return c.json({ kind: "create", proposal: result.proposal });
        }
        return c.json({
          kind: "query",
          answer: result.answer,
          window_label: result.window_label,
          person: result.person,
          shifts: result.shifts,
        });
      }

      return c.json({ error: result.error }, 422);
    } catch (err) {
      return aiFailure(c, err, "Failed to process request");
    }
  });
