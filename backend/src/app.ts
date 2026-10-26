
import express from "express";
import "./db/index.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { leaveRouter } from "./modules/leave/leave.routes.js";
import { employeesRouter } from "./modules/employees/employees.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { holidayRouter } from "./modules/holidays/holiday.routes.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { csrfProtection } from "./middleware/csrf.js";
import { departmentsRouter } from "./modules/departments/departments.routes.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { operationsRouter } from "./modules/operations/operations.routes.js";
import { communicationsRouter } from "./modules/communications/communications.routes.js";
import { payrollRouter } from "./modules/payroll/payroll.routes.js";
import { workRouter } from "./modules/work/work.routes.js";
import { organizationsRouter } from "./modules/organizations/organizations.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { performanceRouter } from "./modules/performance/performance.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import type { MongoClient } from "mongodb";
import { tenants } from "./tenancy/context.js";

export function createApp(mongoClient: MongoClient) {
const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(compression());
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      const devLocal =
        env.NODE_ENV !== "production" &&
        !!origin &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (!origin || devLocal || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

const sessionStore = MongoStore.create({
  // Reuse Mongoose's connection. A separate MongoStore client can fail DNS
  // resolution independently after the API has already connected successfully.
  client: mongoClient,
  dbName: "agibble_hrms",
  collectionName: "sessions",
  ttl: env.SESSION_MAX_AGE_HOURS * 3600,
  autoRemove: "native",
  touchAfter: 300,
});

sessionStore.on("error", (error) => {
  console.error("MongoDB session store error:", error);
});

app.use(
  session({
    name: "agibble.sid",
    store: sessionStore,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      maxAge: env.SESSION_MAX_AGE_HOURS * 3600000,
      path: "/",
    },
  })
);

// Sessions must exist before tenancy and CSRF can read their state.
app.use((req, _res, next) => tenants.run({ organizationId: req.session.organizationId ?? (req.get("x-organization")?.trim().toLowerCase() || "default") }, next));
app.use(csrfProtection);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/operations", operationsRouter);
app.use("/api/communications", communicationsRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/work", workRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/performance", performanceRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/holidays", holidayRouter);

app.use(notFound);
app.use(errorHandler);

return app;
}
