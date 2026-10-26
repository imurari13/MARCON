import test from "node:test";
import assert from "node:assert/strict";
import { tenants, currentOrganization, setOrganization } from "./context.js";
test("tenant context defaults and stays isolated per execution context", async () => {
  assert.equal(currentOrganization(), "default");
  await Promise.all([tenants.run({ organizationId: "north" }, async () => { await Promise.resolve(); assert.equal(currentOrganization(), "north"); setOrganization("north-2"); assert.equal(currentOrganization(), "north-2"); }), tenants.run({ organizationId: "south" }, async () => { await Promise.resolve(); assert.equal(currentOrganization(), "south"); })]);
  assert.equal(currentOrganization(), "default");
});
