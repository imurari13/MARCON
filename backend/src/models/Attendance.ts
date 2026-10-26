import mongoose, { Schema, type Document } from "mongoose";

export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  checkIn: Date;
  checkOut?: Date | null;
}

const schema = new Schema<IAttendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
  },
  { timestamps: true }
);
schema.index({ userId: 1, date: 1 }, { unique: true });
schema.index({ organizationId: 1, date: 1 });

export default mongoose.model<IAttendance>("Attendance", schema);
