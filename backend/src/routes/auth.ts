import { Elysia } from "elysia";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/auth-guard";
import { generateTempPassword, hashPassword, verifyPassword } from "../lib/password";
import { serializeUser } from "../lib/serialize";
import { requireUser } from "../lib/auth-guard";
import { createAccessToken } from "../lib/session";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login", async ({ body, set }) => {
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      set.status = 400;
      return { error: "Email and password are required" };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user?.passwordHash) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const accessToken = await createAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    return {
      message: "Login successful",
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        profile: serializeUser(user),
      },
    };
  })
  .post("/register-company", async ({ body, set }) => {
    const { companyName, name, email, password } = body as {
      companyName?: string;
      name?: string;
      email?: string;
      password?: string;
    };

    if (!companyName || !name || !email || !password) {
      set.status = 400;
      return { error: "All fields are required" };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      set.status = 400;
      return { error: "Email already registered" };
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          fullName: name,
          email,
          passwordHash,
          role: "owner",
        },
      });

      const company = await tx.company.create({
        data: {
          name: companyName,
          ownerId: owner.id,
        },
      });

      const profile = await tx.user.update({
        where: { id: owner.id },
        data: { companyId: company.id },
        include: { company: true },
      });

      return { company, profile };
    });

    set.status = 201;
    return {
      message: "Company registered successfully",
      companyId: result.company.id,
    };
  })
  .post("/reset-password", async ({ body, set }) => {
    const { email } = body as { email?: string };

    if (!email) {
      set.status = 400;
      return { error: "Email is required" };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, role: true },
    });

    if (!existingUser) {
      set.status = 404;
      return { error: "No account found with that email address" };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash },
    });

    return {
      message: "Temporary password generated. Copy it now — it will not be emailed.",
      tempPassword,
    };
  })
  .post("/update-avatar", async ({ body, headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const { avatarUrl } = body as { avatarUrl?: string };

      if (!avatarUrl) {
        set.status = 400;
        return { error: "Avatar URL is required" };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      });

      return { message: "Profile picture updated successfully" };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    }
  })
  .post("/change-password", async ({ body, headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const { currentPassword, newPassword } = body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!currentPassword || !newPassword) {
        set.status = 400;
        return { error: "Current and new passwords are required" };
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        set.status = 400;
        return { error: "Incorrect current password." };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword) },
      });

      return { message: "Password updated successfully" };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    }
  })
  .get("/me", async ({ headers }) => {
    const payload = await import("../lib/session").then((m) =>
      m.getAuthFromBearer(headers.authorization ?? null),
    );

    if (!payload?.sub) {
      return { user: null };
    }

    const profile = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });

    if (!profile) {
      return { user: null };
    }

    return {
      user: {
        id: profile.id,
        email: profile.email,
        profile: serializeUser(profile),
      },
    };
  });
