
import type { Request, Response, NextFunction } from "express";
import User from "../models/User.js";
import { setOrganization } from "../tenancy/context.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    setOrganization(req.session.organizationId ?? "default");
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = await User.findById(userId).select(
      "employeeId name email role department managerId designation workStartTime workEndTime isActive passwordChangeRequired"
    ).lean();

    if (!user || !user.isActive) {
      await new Promise<void>((resolve) => {
        req.session.destroy(() => resolve());
      });

      res.clearCookie("agibble.sid", { path: "/" });
      res.status(401).json({ error: "Session is no longer valid" });
      return;
    }

    res.locals.user = {
      id: String(user._id),
      employeeCode: user.employeeId,
      fullName: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.department ?? null,
      managerId: user.managerId?.toString() ?? null,
      designation: user.designation ?? null,
      workStartTime: user.workStartTime,
      workEndTime: user.workEndTime,
      passwordChangeRequired: user.passwordChangeRequired,
    };

    next();
  } catch (error) {
    next(error);
  }
}
