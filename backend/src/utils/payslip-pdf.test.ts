import test from "node:test";
import assert from "node:assert/strict";
import { payslipPdf } from "./payslip-pdf.js";

test("payslip generator emits a PDF containing payroll data", () => {
  const pdf = payslipPdf({
    company: "MarcOn", employee: "A. Person", employeeId: "E001", month: "2026-10",
    gross: 1500, deductions: 320, net: 1180, status: "FINALIZED",
  }).toString("latin1");
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /Net pay: 1180\.00/);
  assert.match(pdf, /%%EOF$/);
});
