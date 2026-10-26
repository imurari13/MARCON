   import bcrypt from "bcryptjs";
   import { env } from "../config/env.js";
   import { connectDB, mongoose } from "../db/index.js";
   import User from "../models/User.js";

   async function main(): Promise<void> {
     const password = env.INITIAL_ADMIN_PASSWORD;
     if (!password) throw new Error("Set INITIAL_ADMIN_PASSWORD in backend/.env first (12+ characters).");

     await connectDB();
     // Use the raw collection so legacy pre-tenancy records (with no
     // organizationId) can be recovered without a broad database migration.
     const admin = await User.collection.findOne({ employeeId: "CEO-001" });
     if (!admin) throw new Error("No CEO-001 account found. Run admin:create instead.");

     await User.collection.updateOne(
       { _id: admin._id },
       { $set: { password: await bcrypt.hash(password, 12), isActive: true, organizationId: "default", passwordChangeRequired: false } }
     );
     console.log("CEO password reset. Sign in with email:", admin.email);
   }

   main()
     .catch((e: unknown) => { console.error(e instanceof Error ? e.message : "Reset failed"); process.exitCode = 1; })
     .finally(async () => { await mongoose.disconnect().catch(() => undefined); });
