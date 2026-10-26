
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import User from "../../models/User.js";
import { env } from "../../config/env.js";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/require-auth.js";
import { audit } from "../../utils/audit.js";
import { createSecret, verifyTotp } from "../../utils/totp.js";
import { setOrganization } from "../../tenancy/context.js";

export const authRouter = Router();

authRouter.get("/csrf", (req, res) => {
  req.session.csrfToken ??= crypto.randomBytes(32).toString("hex");
  res.json({ token: req.session.csrfToken });
});

const loginLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many login attempts. Try again later.",
  },
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Enter a valid email and password",
      });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const organizationId = req.get("x-organization")?.trim().toLowerCase() || "default";
    setOrganization(organizationId);

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.isActive || !user.password || !(await bcrypt.compare(parsed.data.password, user.password))) {
      res.status(401).json({
        error: "Invalid email or password",
      });
      return;
    }

    if (user.mfaEnabled) {
      req.session.pendingMfaUserId = user.id;
      req.session.organizationId = user.organizationId;
      await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
      res.status(202).json({ mfaRequired: true });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    req.session.userId = user.id;
    req.session.organizationId = user.organizationId;
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");

    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    void User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(() => undefined);
    void audit(req, "AUTH_LOGIN", "User", user.id);

    res.json({
      csrfToken: req.session.csrfToken,
      user: {
        id: user.id,
        employeeCode: user.employeeId,
        fullName: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.department ?? null,
        designation: user.designation ?? null,
        workStartTime: user.workStartTime,
        workEndTime: user.workEndTime,
        dateOfBirth: user.dateOfBirth ?? null,
        managerId: user.managerId?.toString() ?? null,
        passwordChangeRequired: user.passwordChangeRequired,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/mfa/verify-login", async (req, res, next) => {
  try {
    const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    const userId = req.session.pendingMfaUserId;
    if (!parsed.success || !userId) { res.status(400).json({ error: "MFA verification is not pending" }); return; }
    setOrganization(req.session.organizationId ?? "default");
    const user = await User.findById(userId).select("+mfaSecret");
    if (!user?.mfaEnabled || !user.mfaSecret || !verifyTotp(user.mfaSecret, parsed.data.code)) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    delete req.session.pendingMfaUserId;
    req.session.userId = user.id;
    req.session.organizationId = user.organizationId;
    setOrganization(user.organizationId);
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    void audit(req, "MFA_LOGIN", "User", user.id);
    res.json({
      csrfToken: req.session.csrfToken,
      user: {
        id: user.id, employeeCode: user.employeeId, fullName: user.name, email: user.email,
        role: user.role, departmentId: user.department ?? null, managerId: user.managerId?.toString() ?? null,
        designation: user.designation ?? null, workStartTime: user.workStartTime,
        workEndTime: user.workEndTime, dateOfBirth: user.dateOfBirth ?? null,
        passwordChangeRequired: user.passwordChangeRequired,
      },
    });
  } catch (error) { next(error); }
});

authRouter.post("/mfa/setup", requireAuth, async (req, res, next) => {
  try {
    const user = res.locals.user as { id: string; role: string; email: string };
    if (!["CEO", "HR"].includes(user.role)) { res.status(403).json({ error: "MFA is required only for CEO and HR accounts" }); return; }
    const secret = createSecret();
    await User.findByIdAndUpdate(user.id, { $set: { mfaSecret: secret, mfaEnabled: false } });
    res.json({ secret, otpauth: `otpauth://totp/MarcOn:${encodeURIComponent(user.email)}?secret=${secret}&issuer=MarcOn` });
  } catch (error) { next(error); }
});

authRouter.post("/mfa/confirm", requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    const user = await User.findById(res.locals.user.id).select("+mfaSecret");
    if (!parsed.success || !user?.mfaSecret || !verifyTotp(user.mfaSecret, parsed.data.code)) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }
    user.mfaEnabled = true;
    await user.save();
    void audit(req, "MFA_ENABLED", "User", user.id);
    res.status(204).end();
  } catch (error) { next(error); }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    setOrganization(req.session.organizationId ?? "default");
    const userId = req.session.userId;

    if (!userId) {
      res.json({ user: null });
      return;
    }

    const user = await User.findById(userId).select(
      "employeeId name email role department managerId designation workStartTime workEndTime dateOfBirth isActive passwordChangeRequired"
    );

    if (!user || !user.isActive) {
      await new Promise<void>((resolve) => {
        req.session.destroy(() => resolve());
      });
      res.clearCookie("agibble.sid", { path: "/" });
      res.json({ user: null });
      return;
    }

    res.json({
      user: {
        id: user.id,
        employeeCode: user.employeeId,
        fullName: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.department ?? null,
        designation: user.designation ?? null,
        workStartTime: user.workStartTime,
        workEndTime: user.workEndTime,
        dateOfBirth: user.dateOfBirth ?? null,
        managerId: user.managerId?.toString() ?? null,
        passwordChangeRequired: user.passwordChangeRequired,
      },
    });
  } catch (error) {
    next(error);
  }
});

const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) });
authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "New passwords must be at least 12 characters" }); return; }
    const user = await User.findById(res.locals.user.id).select("+password");
    if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.password))) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    if (await bcrypt.compare(parsed.data.newPassword, user.password)) { res.status(400).json({ error: "Choose a different password" }); return; }
    user.password = await bcrypt.hash(parsed.data.newPassword, 12); user.passwordChangeRequired = false; await user.save();
    void audit(req, "PASSWORD_CHANGED", "User", user.id);
    res.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie("agibble.sid", {
      path: "/",
    });

    res.status(204).end();
  });
});
