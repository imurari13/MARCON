import mongoose, { Schema, type Document } from "mongoose";

export interface IWorkFromHomeRequest extends Document {
  userId: mongoose.Types.ObjectId;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "PENDING_MANAGER" | "PENDING_HR" | "APPROVED" | "REJECTED";
  managerApprovedBy?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
}

const schema = new Schema<IWorkFromHomeRequest>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ["PENDING", "PENDING_MANAGER", "PENDING_HR", "APPROVED", "REJECTED"], default: "PENDING" },
  managerApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
}, { timestamps: true });

schema.index({ userId: 1, createdAt: -1 });
schema.index({ organizationId: 1, status: 1, startDate: 1, endDate: 1 });

export default mongoose.model<IWorkFromHomeRequest>("WorkFromHomeRequest", schema);
