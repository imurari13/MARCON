import mongoose, { Schema, type Document } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  code: string;
  managerId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
}

const schema = new Schema<IDepartment>({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IDepartment>("Department", schema);
