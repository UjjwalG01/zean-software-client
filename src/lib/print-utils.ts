import { formatNPR, type Transaction, type Booking } from "./mock-data";

// HTML escape helper to prevent XSS when interpolating user-supplied data
function escHtml(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Number to words for NPR
function numberToWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numberToWords(-n);

  let words = "";
  if (Math.floor(n / 100000) > 0) { words += numberToWords(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
  if (Math.floor(n / 1000) > 0) { words += numberToWords(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
  if (Math.floor(n / 100) > 0) { words += ones[Math.floor(n / 100)] + " Hundred "; n %= 100; }
  if (n > 0) {
    if (n < 20) words += ones[n];
    else { words += tens[Math.floor(n / 10)]; if (n % 10 > 0) words += " " + ones[n % 10]; }
  }
  return words.trim();
}

export function generateA5BillHTML(options: {
  companyName: string;
  companyTagline?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogoUrl?: string;
  vatNo?: string;
  guestName: string;
  memberCode?: string;
  memberClass?: string;
  billNo: string;
  billDate: string;
  billForMonth: string;
  items: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  luxuryTax?: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount?: number;
  paymentMethod?: string;
  status?: string;
  remarks?: string;
  attendant?: string;
}): string {
  const o = options;
  const paid = o.paidAmount ?? o.grandTotal;
  const isPaidInFull = paid >= o.grandTotal;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${escHtml(o.billNo)}</title>
<style>
@page { size: A5 portrait; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #1f2937; background: #ffffff; width: 148mm; min-height: 210mm; position: relative; }
.page { position: relative; padding: 0 0 16mm; min-height: 210mm; overflow: hidden; }
.watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 75mm; opacity: 0.07; pointer-events: none; z-index: 0; }
.header { background: #1e3a8a; color: #fff; padding: 14mm 12mm 9mm; text-align: center; position: relative; z-index: 1; }
.header h1 { font-size: 20px; font-weight: 700; letter-spacing: 0.3px; margin-bottom: 4px; }
.header .tagline { font-size: 10px; font-style: italic; opacity: 0.9; margin-bottom: 6px; }
.header .contact { font-size: 9.5px; opacity: 0.95; letter-spacing: 0.2px; }
.header .contact span { margin: 0 6px; }
.title-bar { background: #eef2ff; color: #1e3a8a; text-align: center; font-weight: 700; letter-spacing: 1.5px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #c7d2fe; position: relative; z-index: 1; }
.body-pad { padding: 8mm 12mm 0; position: relative; z-index: 1; }
.row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px; }
.row .label { color: #6b7280; font-weight: 600; min-width: 80px; display: inline-block; }
.row .val { color: #111827; font-weight: 600; }
.divider { border: none; border-top: 1px solid #e5e7eb; margin: 7px 0 9px; }
.member-block { margin: 6px 0 10px; }
.member-block .row { margin-bottom: 5px; }
table.items { width: 100%; border-collapse: collapse; margin: 8px 0 0; }
table.items thead th { background: #1e3a8a; color: #fff; padding: 8px 10px; font-size: 10.5px; text-align: left; font-weight: 700; letter-spacing: 0.4px; }
table.items thead th.right { text-align: right; }
table.items tbody td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
table.items tbody td.right { text-align: right; }
.net-row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 11px; }
.paid-bar { background: #1e3a8a; color: #fff; display: flex; justify-content: space-between; padding: 9px 10px; font-weight: 700; font-size: 12px; letter-spacing: 0.3px; margin-top: 2px; }
.meta-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 10px 4px; font-size: 11px; }
.meta-row .method { color: #1e3a8a; font-weight: 600; }
.status-pill { color: #16a34a; font-weight: 700; letter-spacing: 0.6px; font-size: 11px; }
.remarks { font-style: italic; color: #6b7280; font-size: 10px; padding: 0 10px 8px; }
.thanks { text-align: center; color: #b45309; font-style: italic; font-size: 10.5px; margin-top: 20px; }
.signature { text-align: right; padding: 16px 12mm 0; font-size: 10px; color: #4b5563; }
.signature .line { display: inline-block; width: 50mm; border-bottom: 1px solid #6b7280; margin-left: 6px; height: 14px; vertical-align: bottom; }
</style></head><body>
<div class="page">
${o.companyLogoUrl ? `<img class="watermark" src="${escHtml(o.companyLogoUrl)}" alt="" />` : ""}
<div class="header">
  <h1>${escHtml(o.companyName)}</h1>
  ${o.companyTagline ? `<div class="tagline">${escHtml(o.companyTagline)}</div>` : ""}
  <div class="contact">
    ${o.companyAddress ? `<span>${escHtml(o.companyAddress)}</span>` : ""}
    ${o.companyPhone ? `<span>|</span><span>${escHtml(o.companyPhone)}</span>` : ""}
    ${o.companyEmail ? `<span>|</span><span>${escHtml(o.companyEmail)}</span>` : ""}
  </div>
</div>
<div class="title-bar">FEE PAYMENT RECEIPT</div>
<div class="body-pad">
  <div class="row">
    <div><span class="label">Receipt No:</span> <span class="val">${escHtml(o.billNo)}</span></div>
    <div><span class="label">Date:</span> <span class="val">${escHtml(o.billDate)}</span></div>
  </div>
  <hr class="divider" />
  <div class="member-block">
    <div class="row"><div><span class="label">Member Name:</span> <span class="val">${escHtml(o.guestName.toUpperCase())}</span></div></div>
    ${o.memberCode ? `<div class="row"><div><span class="label">Member ID:</span> <span class="val">${escHtml(o.memberCode)}</span></div></div>` : ""}
    ${o.memberClass ? `<div class="row"><div><span class="label">Tier / Plan:</span> <span class="val">${escHtml(o.memberClass)}</span></div></div>` : ""}
  </div>
  <table class="items">
    <thead><tr><th>Fee Description</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${o.items.map((it) => `<tr><td>${escHtml(it.description)}</td><td class="right">NPR ${it.amount.toFixed(2)}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="net-row"><span>Net Amount</span><span>NPR ${o.grandTotal.toFixed(2)}</span></div>
  <div class="paid-bar"><span>Amount Paid</span><span>NPR ${paid.toFixed(2)}</span></div>
  <div class="meta-row">
    <span class="method">Payment Method: ${escHtml(o.paymentMethod || "Cash")}</span>
    <span class="status-pill">${isPaidInFull ? "PAID IN FULL" : (o.status || "PARTIAL").toUpperCase()}</span>
  </div>
  ${o.remarks ? `<div class="remarks">Remarks: ${escHtml(o.remarks)}</div>` : ""}
  <hr class="divider" />
  <div class="thanks">Thank you for the payment!!!</div>
</div>
<div class="signature">Authorized Signature: <span class="line"></span></div>
</div>
</body></html>`;
}

export function printHTML(html: string) {
  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export interface CSVExportMeta {
  /** Property/Company name (e.g. "VitaFit Club") */
  propertyName?: string;
  /** Title of the report */
  reportTitle?: string;
  /** Date or date range string */
  dateRange?: string;
  /** Generated-on timestamp (defaults to now) */
  generatedAt?: string;
  /** Filters as { Label: Value } */
  filters?: Record<string, string>;
}

export function exportTableToCSV(
  headers: string[],
  rows: string[][],
  filename: string,
  meta?: CSVExportMeta
) {
  const lines: string[] = [];
  if (meta) {
    if (meta.propertyName) lines.push(csvEscape(meta.propertyName));
    if (meta.reportTitle) lines.push(csvEscape(meta.reportTitle));
    if (meta.dateRange) lines.push(csvEscape(`Date: ${meta.dateRange}`));
    lines.push(csvEscape(`Generated: ${meta.generatedAt || new Date().toLocaleString()}`));
    if (meta.filters && Object.keys(meta.filters).length > 0) {
      lines.push(csvEscape("Filters:"));
      Object.entries(meta.filters).forEach(([k, v]) => {
        lines.push(`${csvEscape(k)},${csvEscape(v)}`);
      });
    }
    lines.push(""); // blank separator row
  }
  lines.push(headers.map(csvEscape).join(","));
  rows.forEach((r) => lines.push(r.map(csvEscape).join(",")));
  const csv = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateReceiptHTML(
  t: Transaction,
  companyName: string,
  extras?: {
    companyTagline?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyLogoUrl?: string;
    memberCode?: string;
    memberClass?: string;
    paymentMethod?: string;
    remarks?: string;
  }
): string {
  return generateA5BillHTML({
    companyName,
    companyTagline: extras?.companyTagline,
    companyAddress: extras?.companyAddress,
    companyPhone: extras?.companyPhone,
    companyEmail: extras?.companyEmail,
    companyLogoUrl: extras?.companyLogoUrl,
    memberCode: extras?.memberCode,
    memberClass: extras?.memberClass,
    paymentMethod: extras?.paymentMethod,
    remarks: extras?.remarks,
    guestName: t.memberName,
    billNo: t.receiptNo,
    billDate: t.date,
    billForMonth: new Date(t.date).toLocaleString("en", { month: "long", year: "numeric" }),
    items: [{ description: t.description, quantity: 1, rate: t.amount, amount: t.amount }],
    subtotal: t.amount,
    taxableAmount: t.amount,
    vatAmount: t.vat,
    grandTotal: t.total,
    paidAmount: t.total,
  });
}
