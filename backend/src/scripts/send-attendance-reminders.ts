import { connectDB, mongoose } from "../db/index.js";
import Attendance from "../models/Attendance.js";
import Notification from "../models/Notification.js";
import { todayISO } from "../utils/date.js";
import Organization from "../models/Organization.js";
import { tenants } from "../tenancy/context.js";

async function run() {
  await connectDB();
  const today = todayISO(); const day = new Date(`${today}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - 1); const date = day.toISOString().slice(0, 10);
  const organizations = [{ slug: "default" }, ...(await Organization.find({ isActive: true }).select("slug"))]; let count = 0;
  for (const organization of organizations) await tenants.run({ organizationId: organization.slug }, async () => { const records = await Attendance.find({ date, checkOut: null }); count += records.length; for (const record of records) await Notification.updateOne({ userId: record.userId, type: "MISSED_CHECKOUT", link: `/attendance?date=${date}` }, { $setOnInsert: { title: "Missed check-out", body: `You did not check out on ${date}. Submit an attendance correction if needed.`, type: "MISSED_CHECKOUT", link: `/attendance?date=${date}` } }, { upsert: true }); });
  console.log(`Created reminders for ${count} missed check-outs.`); await mongoose.disconnect();
}
void run().catch(async error => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
