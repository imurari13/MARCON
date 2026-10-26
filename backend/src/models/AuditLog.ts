import mongoose, { Schema, type Document } from "mongoose";

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

const schema = new Schema<IAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true, trim: true },
  entityType: { type: String, required: true, trim: true },
  entityId: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
}, { timestamps: true });
schema.index({ createdAt: -1 });
export default mongoose.model<IAuditLog>("AuditLog", schema);
