import test from "node:test";
import assert from "node:assert/strict";
import { createSecret, verifyTotp } from "./totp.js";
test("TOTP secrets are base32 and invalid codes are rejected",()=>{const secret=createSecret();assert.match(secret,/^[A-Z2-7]{20}$/);assert.equal(verifyTotp(secret,"000000"),false);});
