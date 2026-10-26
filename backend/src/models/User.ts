
import mongoose, { Schema, type Document } from "mongoose";

export type UserRole = "CEO" | "HR" | "MANAGER" | "EMPLOYEE";

export interface IUser extends Document {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  managerId?: mongoose.Types.ObjectId | null;
  shiftId?: mongoose.Types.ObjectId | null;
  designation?: string;
  workStartTime: string;
  workEndTime: string;
  dateOfBirth?: string | null; // YYYY-MM-DD
  isActive: boolean;
  lastLoginAt?: Date | null;
  passwordChangeRequired: boolean;
  mfaSecret?: string | null;
  mfaEnabled: boolean;
  organizationId: string;
}

const userSchema = new Schema<IUser>(
  {
    employeeId: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["CEO", "HR", "MANAGER", "EMPLOYEE"],
      default: "EMPLOYEE",
      required: true
    },
    department: {
      type: String,
      default: null
    },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift", default: null },
    designation: {
      type: String,
      default: null
    },
    workStartTime: { type: String, default: "09:30" },
    workEndTime: { type: String, default: "18:30" },
    dateOfBirth: { type: String, default: null },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
    ,passwordChangeRequired: { type: Boolean, default: false }
    ,mfaSecret: { type: String, select: false, default: null }
    ,mfaEnabled: { type: Boolean, default: false }
    ,organizationId: { type: String, required: true, default: "default", index: true }
  },
  {
    timestamps: true
  }
);
userSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

userSchema.index({ organizationId: 1, isActive: 1, role: 1 });
userSchema.index({ organizationId: 1, managerId: 1 });
const User = mongoose.model<IUser>("User", userSchema);

export default User;
