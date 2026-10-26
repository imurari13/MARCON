import { connectDB, mongoose } from "../db/index.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Holiday from "../models/Holiday.js";
import Department from "../models/Department.js";
import LeavePolicy from "../models/LeavePolicy.js";
import AttendanceRegularization from "../models/AttendanceRegularization.js";
import AuditLog from "../models/AuditLog.js";
import Shift from "../models/Shift.js";
import Overtime from "../models/Overtime.js";
import Notification from "../models/Notification.js";
import Announcement from "../models/Announcement.js";
import EmployeeDocument from "../models/EmployeeDocument.js";
import SalaryStructure from "../models/SalaryStructure.js";
import PayrollRun from "../models/PayrollRun.js";
import WorkItem from "../models/WorkItem.js";
import { Job, Candidate } from "../models/Recruitment.js";
import PerformanceReview from "../models/PerformanceReview.js";

async function run() {
  await connectDB();
  const models = [User, Attendance, LeaveRequest, Holiday, Department, LeavePolicy, AttendanceRegularization, AuditLog, Shift, Overtime, Notification, Announcement, EmployeeDocument, SalaryStructure, PayrollRun, WorkItem, Job, Candidate, PerformanceReview];
  for (const model of models) { await model.collection.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: "default" } }); }
  await User.syncIndexes();
  console.log("Tenancy migration complete. Existing records belong to organization 'default'.");
  await mongoose.disconnect();
}
void run().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
