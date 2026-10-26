import mongoose, { Schema, type Document } from "mongoose";

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "UNPAID";
export interface ILeavePolicy extends Document { year: number; leaveType: LeaveType; annualQuota: number; carryForwardLimit: number; }
const schema = new Schema<ILeavePolicy>({
  year: { type: Number, required: true },
  leaveType: { type: String, enum: ["CASUAL", "SICK", "EARNED", "UNPAID"], required: true },
  annualQuota: { type: Number, required: true, min: 0 },
  carryForwardLimit: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });
schema.index({ year: 1, leaveType: 1 }, { unique: true });
export default mongoose.model<ILeavePolicy>("LeavePolicy", schema);
