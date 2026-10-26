import mongoose, { Schema, Document } from "mongoose";

export interface IHoliday extends Document {
  name: string;
  date: string;
  description?: string;
  createdBy: mongoose.Types.ObjectId;
}

const holidaySchema = new Schema<IHoliday>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
    description: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1 });
holidaySchema.index({ organizationId: 1, date: 1 });

export default mongoose.model<IHoliday>("Holiday", holidaySchema);