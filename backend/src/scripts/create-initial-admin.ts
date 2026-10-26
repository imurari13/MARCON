
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { connectDB, mongoose } from "../db/index.js";
import User from "../models/User.js";

async function main(): Promise<void> {
  const {
    INITIAL_ADMIN_NAME: name,
    INITIAL_ADMIN_EMAIL: emailValue,
    INITIAL_ADMIN_PASSWORD: password
  } = env;

  if (!name || !emailValue || !password) {
    throw new Error(
      "Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in your environment."
    );
  }

  await connectDB();

  const email = emailValue.toLowerCase().trim();

  const existing = await User.findOne({
    $or: [{ email }, { employeeId: "CEO-001" }]
  }).select("_id");

  if (existing) {
    throw new Error(
      "An account with this email or employee ID already exists. No changes made."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await User.create({
    employeeId: "CEO-001",
    name,
    email,
    password: passwordHash,
    role: "CEO",
    isActive: true
  });

  console.log("Initial CEO account created:", {
    employeeId: admin.employeeId,
    email: admin.email,
    role: admin.role
  });
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Failed to create CEO account."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
