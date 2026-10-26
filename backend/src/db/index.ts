
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { currentOrganization } from "../tenancy/context.js";

mongoose.plugin((schema) => {
  if ((schema.options as { tenantScoped?: boolean }).tenantScoped === false) return;
  if (!schema.path("organizationId")) schema.add({ organizationId: { type: String, required: true, default: "default", index: true } });
  schema.pre("save", function () { if (!this.get("organizationId")) this.set("organizationId", currentOrganization()); });
  for (const operation of ["countDocuments", "find", "findOne", "findOneAndUpdate", "findOneAndDelete", "updateOne", "updateMany", "deleteOne", "deleteMany"] as const) schema.pre(operation, function () { const filter = this.getFilter(); if (!Object.prototype.hasOwnProperty.call(filter, "organizationId")) this.where({ organizationId: currentOrganization() }); });
  schema.pre("aggregate", function () { const pipeline = this.pipeline(); if (!pipeline.some((stage) => "$match" in stage && Object.prototype.hasOwnProperty.call(stage.$match ?? {}, "organizationId"))) pipeline.unshift({ $match: { organizationId: currentOrganization() } }); });
});


let isConnecting = false;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (isConnecting) {
    throw new Error("MongoDB connection is already in progress");
  }

  isConnecting = true;

  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: "agibble_hrms",
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed");
    throw error;
  } finally {
    isConnecting = false;
  }
}

export { mongoose };
