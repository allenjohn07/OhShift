import { Elysia } from "elysia";
import { ApiError, requireManager } from "../lib/auth-guard";
import { askSchedule } from "../lib/nl-schedule-ask";
import { parseShiftFromPrompt } from "../lib/nl-shift-parse";
import { prisma } from "../lib/prisma";

async function loadRosterAndPresets(user: {
  id: string;
  companyId: string | null;
  fullName: string;
  designation: string | null;
}) {
  const rosterRows = await prisma.user.findMany({
    where: {
      companyId: user.companyId!,
      OR: [
        { role: { in: ["employee", "manager"] } },
        { id: user.id },
      ],
    },
    select: {
      id: true,
      fullName: true,
      designation: true,
    },
    orderBy: { fullName: "asc" },
  });

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

  const company = await prisma.company.findUnique({
    where: { id: user.companyId! },
    select: {
      morningStart: true,
      morningEnd: true,
      eveningStart: true,
      eveningEnd: true,
    },
  });

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

export const aiRoutes = new Elysia({ prefix: "/ai" })
  .post("/parse-shift", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { prompt, timezone, employeeId } = body as {
        prompt?: string;
        timezone?: string;
        employeeId?: string;
      };

      const trimmed = typeof prompt === "string" ? prompt.trim() : "";
      if (!trimmed) {
        set.status = 400;
        return { error: "Prompt is required" };
      }
      if (trimmed.length > 500) {
        set.status = 400;
        return { error: "Prompt is too long" };
      }

      const tz =
        typeof timezone === "string" && timezone.trim()
          ? timezone.trim()
          : "UTC";

      const { roster, selfRow, presets } = await loadRosterAndPresets(user);

      const result = await parseShiftFromPrompt({
        prompt: trimmed,
        timezone: tz,
        roster,
        self: selfRow,
        presets,
        lockEmployeeId:
          typeof employeeId === "string" && employeeId.trim()
            ? employeeId.trim()
            : null,
      });

      if ("employee_id" in result) {
        return { proposal: result };
      }

      set.status = 422;
      return { error: result.error };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to parse shift request";
      set.status = aiErrorStatus(message);
      return { error: message };
    }
  })
  .post("/ask", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { prompt, timezone } = body as {
        prompt?: string;
        timezone?: string;
      };

      const trimmed = typeof prompt === "string" ? prompt.trim() : "";
      if (!trimmed) {
        set.status = 400;
        return { error: "Prompt is required" };
      }
      if (trimmed.length > 500) {
        set.status = 400;
        return { error: "Prompt is too long" };
      }

      const tz =
        typeof timezone === "string" && timezone.trim()
          ? timezone.trim()
          : "UTC";

      const { roster, selfRow, presets } = await loadRosterAndPresets(user);

      const result = await askSchedule({
        prompt: trimmed,
        companyId: user.companyId!,
        timezone: tz,
        roster,
        self: selfRow,
        presets,
      });

      if ("kind" in result) {
        if (result.kind === "create") {
          return { kind: "create", proposal: result.proposal };
        }
        return {
          kind: "query",
          answer: result.answer,
          window_label: result.window_label,
          person: result.person,
          shifts: result.shifts,
        };
      }

      set.status = 422;
      return { error: result.error };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to process request";
      set.status = aiErrorStatus(message);
      return { error: message };
    }
  });
