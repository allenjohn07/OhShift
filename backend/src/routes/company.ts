import { Elysia } from "elysia";
import { ApiError, requireManager } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { serializeCompany } from "../lib/serialize";

export const companyRoutes = new Elysia({ prefix: "/company" }).put(
  "/",
  async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const updates = body as {
        morning_start?: string;
        morning_end?: string;
        evening_start?: string;
        evening_end?: string;
      };

      const company = await prisma.company.update({
        where: { id: user.companyId! },
        data: {
          morningStart: updates.morning_start || "08:00",
          morningEnd: updates.morning_end || "16:00",
          eveningStart: updates.evening_start || "16:00",
          eveningEnd: updates.evening_end || "00:00",
        },
      });

      return { company: serializeCompany(company) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  },
);
