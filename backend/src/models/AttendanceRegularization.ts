import mongoose, { Schema, type Document } from "mongoose";
export interface IAttendanceRegularization extends Document { userId: mongoose.Types.ObjectId; date: string; requestedCheckIn?: Date | null; requestedCheckOut?: Date | null; reason: string; status: "PENDING" | "APPROVED" | "REJECTED"; reviewedBy?: mongoose.Types.ObjectId; reviewedAt?: Date; }
const schema = new Schema<IAttendanceRegularization>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, date: { type: String, required: true },
  requestedCheckIn: { type: Date, default: null }, requestedCheckOut: { type: Date, default: null },
  reason: { type: String, required: true, trim: true, maxlength: 500 }, status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" }, reviewedAt: Date,
}, { timestamps: true });
schema.index({ userId: 1, date: 1, status: 1 });
schema.index({ organizationId: 1, status: 1, createdAt: 1 });
schema.index({ userId: 1, createdAt: -1 });
export default mongoose.model<IAttendanceRegularization>("AttendanceRegularization", schema);
