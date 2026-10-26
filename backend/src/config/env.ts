
import "dotenv/config";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce.number().int().positive().default(4000),

    MONGODB_URI: z.string().min(1),

    SESSION_SECRET: z.string().min(32),

    FRONTEND_ORIGIN: z
      .string()
      .url()
      .default("http://localhost:5173"),

    CORS_ORIGINS: z
      .string()
      .default("http://localhost:5173"),

    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    COOKIE_SAME_SITE: z
      .enum(["lax", "strict", "none"])
      .default("lax"),

    SESSION_MAX_AGE_HOURS: z.coerce.number().positive().default(12),

    APP_TIMEZONE: z.string().default("Asia/Kolkata"),

    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .positive()
      .default(900000),

    LOGIN_RATE_LIMIT_MAX: z.coerce
      .number()
      .int()
      .positive()
      .default(10),

    INITIAL_ADMIN_NAME: z.string().optional(),

    INITIAL_ADMIN_EMAIL: z.string().email().optional(),

    INITIAL_ADMIN_PASSWORD: z.string().min(12).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      !value.COOKIE_SECURE
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["COOKIE_SECURE"],
        message: "Must be true in production",
      });
    }

    if (
      value.COOKIE_SAME_SITE === "none" &&
      !value.COOKIE_SECURE
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["COOKIE_SAME_SITE"],
        message: "SameSite=None requires secure cookies",
      });
    }

    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: value.APP_TIMEZONE });
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_TIMEZONE"],
        message: "Must be a valid IANA time zone, e.g. Asia/Kolkata",
      });
    }

    if (
      value.MONGODB_URI &&
      !value.MONGODB_URI.startsWith("mongodb://") &&
      !value.MONGODB_URI.startsWith("mongodb+srv://")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MONGODB_URI"],
        message: "Must be a valid MongoDB connection URI",
      });
    }
  });

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error(result.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = {
  ...result.data,
  CORS_ORIGINS: result.data.CORS_ORIGINS
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
