export interface PayslipData {
  company: string;
  employee: string;
  employeeId: string;
  month: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
}

const escapePdf = (value: string) => value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");

export function payslipPdf(data: PayslipData): Buffer {
  const lines = [
    data.company, "PAYSLIP", `Month: ${data.month}`, "",
    `Employee: ${data.employee}`, `Employee ID: ${data.employeeId}`, "",
    `Gross pay: ${data.gross.toFixed(2)}`, `Deductions: ${data.deductions.toFixed(2)}`,
    `Net pay: ${data.net.toFixed(2)}`, "", `Payroll status: ${data.status}`,
    "This is a system-generated payslip.",
  ];
  const content = `BT\n/F1 12 Tf\n50 790 Td\n${lines.map((line, index) => `${index ? "0 -24 Td\n" : ""}(${escapePdf(line)}) Tj`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
