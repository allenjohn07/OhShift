import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { companies, users } from "../db/schema";
import { readJson, requireUser } from "../lib/auth-guard";
import { generateTempPassword, hashPassword, verifyPassword } from "../lib/password";
import { serializeUser } from "../lib/serialize";
import { createAccessToken, getAuthFromBearer, getDbUser } from "../lib/session";

export const authRoutes = new Hono()
  .post("/login", async (c) => {
    const { email, password } = await readJson<{
      email: string;
      password: string;
    }>(c);

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
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
  .post("/register-company", async (c) => {
    const { companyName, name, email, password } = await readJson<{
      companyName: string;
      name: string;
      email: string;
      password: string;
    }>(c);

    if (!companyName || !name || !email || !password) {
      return c.json({ error: "All fields are required" }, 400);
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
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
        fullName: name,
        email,
        passwordHash,
        role: "owner",
      }),
      db.insert(companies).values({
        id: companyId,
        name: companyName,
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
  .post("/reset-password", async (c) => {
    const { email } = await readJson<{ email: string }>(c);

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });

    if (!existingUser) {
      return c.json({ error: "No account found with that email address" }, 404);
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, existingUser.id));

    return c.json({
      message: "Temporary password generated. Copy it now — it will not be emailed.",
      tempPassword,
    });
  })
  .post("/update-avatar", async (c) => {
    const user = await requireUser(c);
    const { avatarUrl } = await readJson<{ avatarUrl: string }>(c);

    if (!avatarUrl) {
      return c.json({ error: "Avatar URL is required" }, 400);
    }

    await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id));

    return c.json({ message: "Profile picture updated successfully" });
  })
  .post("/change-password", async (c) => {
    const user = await requireUser(c);
    const { currentPassword, newPassword } = await readJson<{
      currentPassword: string;
      newPassword: string;
    }>(c);

    if (!currentPassword || !newPassword) {
      return c.json({ error: "Current and new passwords are required" }, 400);
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Incorrect current password." }, 400);
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.id, user.id));

    return c.json({ message: "Password updated successfully" });
  })
  .get("/me", async (c) => {
    const payload = await getAuthFromBearer(c.req.header("authorization"));
    if (!payload?.sub) {
      return c.json({ user: null });
    }

    const profile = await getDbUser(payload.sub);
    if (!profile) {
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
