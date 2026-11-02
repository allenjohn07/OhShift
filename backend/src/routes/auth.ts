import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { companies, users } from "../db/schema";
import { jsonBody, requireUser } from "../lib/auth-guard";
import { hashPassword, verifyPassword } from "../lib/password";
import { serializeUser } from "../lib/serialize";
import { consumeAccountToken, sendAccountLink } from "../lib/account-tokens";
import { limitAuth } from "../lib/auth-rate-limit";
import { createAccessToken, getAuthFromBearer, getDbUser } from "../lib/session";

type LoginBody = {
  email: string;
  password: string;
};

type RegisterCompanyBody = {
  companyName: string;
  name: string;
  email: string;
  password: string;
};

type ResetPasswordBody = { email: string };

type UpdateAvatarBody = { avatarUrl: string };

type ChangePasswordBody = {
  currentPassword: string;
  newPassword: string;
};

export const authRoutes = new Hono()
  .post("/login", jsonBody<LoginBody>(), async (c) => {
    const { email, password } = c.req.valid("json");
    await limitAuth(c, "login", typeof email === "string" ? email : undefined);

    if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || !password || password.length > 128) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const user = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email?.trim().toLowerCase()}`,
      with: { company: true },
    });

    if (!user?.passwordHash) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const accessToken = await createAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      sessionVersion: user.sessionVersion,
    });

    return c.json({
      message: "Login successful",
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        profile: serializeUser(user),
      },
    });
  })
  .post("/register-company", jsonBody<RegisterCompanyBody>(), async (c) => {
    const { companyName, name, email, password } = c.req.valid("json");
    await limitAuth(c, "register");

    if (typeof companyName !== "string" || !companyName.trim() || companyName.length > 120 || typeof name !== "string" || !name.trim() || name.length > 120 || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 12 || password.length > 128) {
      return c.json({ error: "All fields are required" }, 400);
    }

    const existing = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email?.trim().toLowerCase()}`,
      columns: { id: true },
    });
    if (existing) {
      return c.json({ error: "Email already registered" }, 400);
    }

    const passwordHash = await hashPassword(password);
    const ownerId = crypto.randomUUID();
    const companyId = crypto.randomUUID();

    // users ↔ companies reference each other: insert owner, then company, then link.
    await db.batch([
      db.insert(users).values({
        id: ownerId,
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: "owner",
      }),
      db.insert(companies).values({
        id: companyId,
        name: companyName.trim(),
        ownerId,
      }),
      db.update(users).set({ companyId }).where(eq(users.id, ownerId)),
    ]);

    return c.json(
      {
        message: "Company registered successfully",
        companyId,
      },
      201,
    );
  })
  .post("/reset-password", jsonBody<ResetPasswordBody>(), async (c) => {
    const { email } = c.req.valid("json");

    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return c.json({ error: "Email is required" }, 400);
    }

    await limitAuth(c, "reset", typeof email === "string" ? email : undefined);
    const user = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email?.trim().toLowerCase()}`, columns: { id: true, email: true, fullName: true, sessionVersion: true } });
    if (user) c.executionCtx.waitUntil(sendAccountLink(user, "reset").catch(() => {
      console.error("Account recovery delivery failed");
    }));
    return c.json({ message: "If an account exists for that email, a password link will arrive shortly." });
  })
  .post("/set-password", jsonBody<{ token: string; password: string }>(), async (c) => {
    const { token, password } = c.req.valid("json");
    await limitAuth(c, "set-password");
    if (typeof token !== "string" || typeof password !== "string" || password.length < 12 || password.length > 128) {
      return c.json({ error: "Use a valid link and a password between 12 and 128 characters." }, 400);
    }
    await consumeAccountToken(token, password);
    return c.json({ message: "Password saved. Sign in with your new password." });
  })
  .post("/update-avatar", jsonBody<UpdateAvatarBody>(), async (c) => {
    const user = await requireUser(c);
    const { avatarUrl } = c.req.valid("json");

    if (!avatarUrl) {
      return c.json({ error: "Avatar URL is required" }, 400);
    }

    await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id));

    return c.json({ message: "Profile picture updated successfully" });
  })
  .post("/change-password", jsonBody<ChangePasswordBody>(), async (c) => {
    const user = await requireUser(c);
    const { currentPassword, newPassword } = c.req.valid("json");

    if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128 || typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) {
      return c.json({ error: "Current and new passwords are required" }, 400);
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Incorrect current password." }, 400);
    }

    const [updated] = await db.update(users)
      .set({ passwordHash: await hashPassword(newPassword), sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, user.id), eq(users.sessionVersion, user.sessionVersion)))
      .returning({ id: users.id });
    if (!updated) return c.json({ error: "Your session changed. Sign in again." }, 401);

    return c.json({ message: "Password updated successfully" });
  })
  .get("/me", async (c) => {
    const payload = await getAuthFromBearer(c.req.header("authorization"));
    if (!payload?.sub) {
      return c.json({ user: null });
    }

    const profile = await getDbUser(payload.sub);
    if (!profile || payload.sessionVersion !== profile.sessionVersion) {
      return c.json({ user: null });
    }

    return c.json({
      user: {
        id: profile.id,
        email: profile.email,
        profile: serializeUser(profile),
      },
    });
  });
