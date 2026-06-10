import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { verifyMailConnection } from "./lib/mail";
import { prisma } from "./lib/prisma";
import { authRoutes } from "./routes/auth";
import { companyRoutes } from "./routes/company";
import { dashboardRoutes } from "./routes/dashboard";
import { employeesRoutes } from "./routes/employees";
import { shiftsRoutes } from "./routes/shifts";

const port = Number(process.env.PORT) || 3001;
// Browsers send Origin without a path (e.g. https://user.github.io), so normalize FRONTEND_URL.
const frontendOrigin = process.env.FRONTEND_URL
  ? new URL(process.env.FRONTEND_URL).origin
  : "http://localhost:3000";

const app = new Elysia()
  .use(
    cors({
      origin: frontendOrigin,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .onError(({ error, set }) => {
    console.error(error);
    set.status = 500;
    return { error: "Internal server error" };
  })
  .get("/ping", () => ({
    ok: true,
    service: "ohshift-api",
    timestamp: new Date().toISOString(),
  }))
  .get("/health", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        ok: false,
        database: "disconnected",
        timestamp: new Date().toISOString(),
      };
    }
  })
  .get("/", () => ({
    name: "OhShift API",
    docs: "JWT Bearer auth. Routes: /auth, /shifts, /employees, /company, /dashboard",
  }))
  .use(authRoutes)
  .use(companyRoutes)
  .use(employeesRoutes)
  .use(shiftsRoutes)
  .use(dashboardRoutes)
  .listen(port);

void verifyMailConnection();

console.log(
  `OhShift API running at http://${app.server?.hostname}:${app.server?.port}`,
);
