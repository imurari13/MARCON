import mongoose, { Schema, Document } from "mongoose";

export interface ILeaveRequest extends Document {
  userId: mongoose.Types.ObjectId;
  leaveType: "CASUAL" | "SICK" | "EARNED" | "UNPAID";
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "PENDING_MANAGER" | "PENDING_HR" | "APPROVED" | "REJECTED";
  durationDays: number;
  halfDay: boolean;
  managerApprovedBy?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leaveType: {
      type: String,
      enum: ["CASUAL", "SICK", "EARNED", "UNPAID"],
      required: true,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["PENDING", "PENDING_MANAGER", "PENDING_HR", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    durationDays: { type: Number, required: true, min: 0.5 },
    halfDay: { type: Boolean, default: false },
    managerApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
  },
  { timestamps: true }
);

leaveRequestSchema.index({ userId: 1, createdAt: -1 });
leaveRequestSchema.index({ organizationId: 1, status: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model<ILeaveRequest>(
  "LeaveRequest",
  leaveRequestSchema
);
