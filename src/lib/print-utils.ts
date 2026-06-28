import { formatNPR, type Transaction, type Booking } from "./mock-data";
import { formatDateTime, formatInTz, nowIso } from "./tz";

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
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numberToWords(-n);

  let words = "";
  if (Math.floor(n / 100000) > 0) {
    words += numberToWords(Math.floor(n / 100000)) + " Lakh ";
    n %= 100000;
  }
  if (Math.floor(n / 1000) > 0) {
    words += numberToWords(Math.floor(n / 1000)) + " Thousand ";
    n %= 1000;
  }
  if (Math.floor(n / 100) > 0) {
    words += ones[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) words += ones[n];
    else {
      words += tens[Math.floor(n / 10)];
      if (n % 10 > 0) words += " " + ones[n % 10];
    }
  }
  return words.trim();
}

export interface A5BillItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  /** Optional head used to group the row in the bill (Services, Spa, FIT, Record Charges, etc.). */
  head?: string;
}

export type BillPaperSize = "A4" | "A5" | "80mm";
export type BillKind = "payment" | "advance";

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
  items: A5BillItem[];
  subtotal: number;
  luxuryTax?: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  /** Existing outstanding balance carried forward from prior unsettled charges. */
  previousBalance?: number;
  /** Manual discount applied at settlement time. */
  discount?: number;
  /** Available advance/credit being applied toward this bill. */
  advancePaid?: number;
  /** Cash/POS amount paid right now. */
  paidAmount?: number;
  paymentMethod?: string;
  status?: string;
  remarks?: string;
  attendant?: string;
  /** Paper size for the receipt. Defaults to A5. */
  paperSize?: BillPaperSize;
  /** Receipt kind. 'advance' renders the simpler Advance Receipt layout. */
  kind?: BillKind;
}): string {
  const o = options;
  const paperSize: BillPaperSize = o.paperSize || "A5";
  const kind: BillKind = o.kind || "payment";

  const currentTotal = o.grandTotal;
  const previousBalance = Math.max(0, o.previousBalance || 0);
  const grossDue = currentTotal + previousBalance;
  const discount = Math.max(0, o.discount || 0);
  const advance = Math.max(0, o.advancePaid || 0);
  const netPayable = grossDue - discount - advance;
  const paid = o.paidAmount ?? Math.max(0, netPayable);
  const isRefund = netPayable < 0;
  const isFullyPaid = !isRefund && paid >= netPayable - 0.01;
  const isOverpaid = !isRefund && paid > netPayable + 0.01;
  const statusLabel = isRefund || isOverpaid
    ? "OVERPAID"
    : isFullyPaid
      ? "CLEARED"
      : paid > 0
        ? "PARTIAL"
        : (o.status || "PENDING").toUpperCase();
  const statusColor = isRefund || isOverpaid ? "#b45309" : isFullyPaid ? "#16a34a" : "#dc2626";

  // Paper-size-driven CSS variables
  const sizeCss = (() => {
    switch (paperSize) {
      case "A4":
        return {
          page: "@page { size: A4 portrait; margin: 0; }",
          bodyWidth: "210mm",
          bodyMinHeight: "297mm",
          padX: "16mm",
          headerPad: "16mm 16mm 10mm",
          fontSize: "12px",
        };
      case "80mm":
        return {
          page: "@page { size: 80mm auto; margin: 0; }",
          bodyWidth: "80mm",
          bodyMinHeight: "auto",
          padX: "4mm",
          headerPad: "6mm 4mm 5mm",
          fontSize: "10.5px",
        };
      case "A5":
      default:
        return {
          page: "@page { size: A5 portrait; margin: 0; }",
          bodyWidth: "148mm",
          bodyMinHeight: "210mm",
          padX: "12mm",
          headerPad: "14mm 12mm 9mm",
          fontSize: "11px",
        };
    }
  })();

  const isThermal = paperSize === "80mm";
  const titleText = kind === "advance" ? "ADVANCE RECEIPT" : "PAYMENT RECEIPT";

  // Item rows
  const itemRows = o.items
    .map(
      (it) =>
        `<tr><td>${escHtml(it.description)}</td><td class="right">NPR ${Number(it.amount).toFixed(2)}</td></tr>`,
    )
    .join("");

  // Summary rows differ for payment vs advance
  const summaryRowsPayment = `
    <tr class="sep"><td colspan="2"></td></tr>
    <tr><td>Subtotal</td><td class="right">NPR ${currentTotal.toFixed(2)}</td></tr>
    ${previousBalance > 0 ? `<tr><td>Previous Balance (due)</td><td class="right">NPR ${previousBalance.toFixed(2)}</td></tr>` : ""}
    <tr class="sep"><td colspan="2"></td></tr>
    <tr class="bold"><td>Grand Total</td><td class="right">NPR ${grossDue.toFixed(2)}</td></tr>
    ${advance > 0 ? `<tr class="neg"><td>Advance Amount</td><td class="right">- NPR ${advance.toFixed(2)}</td></tr>` : ""}
    ${discount > 0 ? `<tr class="neg"><td>Discount</td><td class="right">- NPR ${discount.toFixed(2)}</td></tr>` : ""}
    <tr class="sep"><td colspan="2"></td></tr>
    <tr class="bold net"><td>Net Payable</td><td class="right">NPR ${Math.abs(netPayable).toFixed(2)}</td></tr>
    <tr class="bold"><td>Amount Paid</td><td class="right">NPR ${paid.toFixed(2)}</td></tr>
    <tr class="sep"><td colspan="2"></td></tr>
  `;

  const summaryRowsAdvance = `
    <tr class="sep"><td colspan="2"></td></tr>
    <tr class="bold"><td>Amount Paid</td><td class="right">NPR ${paid.toFixed(2)}</td></tr>
    <tr class="sep"><td colspan="2"></td></tr>
  `;

  const summaryRows = kind === "advance" ? summaryRowsAdvance : summaryRowsPayment;

  const itemsTable = kind === "advance"
    ? ""
    : `
    <table class="items">
      <thead><tr><th>Fee Description</th><th class="right">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${escHtml(o.billNo)}</title>
<style>
${sizeCss.page}
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: ${sizeCss.fontSize}; color: #1f2937; background: #ffffff; width: ${sizeCss.bodyWidth}; min-height: ${sizeCss.bodyMinHeight}; position: relative; }
.page { position: relative; padding: 0 0 ${isThermal ? "6mm" : "16mm"}; min-height: ${sizeCss.bodyMinHeight}; overflow: hidden; }
.watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${isThermal ? "50mm" : "75mm"}; opacity: 0.07; pointer-events: none; z-index: 0; }
.header { background: ${isThermal ? "#ffffff" : "#1e3a8a"}; color: ${isThermal ? "#1e3a8a" : "#fff"}; padding: ${sizeCss.headerPad}; text-align: center; position: relative; z-index: 1; ${isThermal ? "border-bottom: 1px dashed #94a3b8;" : ""} }
.header h1 { font-size: ${isThermal ? "14px" : paperSize === "A4" ? "22px" : "20px"}; font-weight: 700; letter-spacing: 0.3px; margin-bottom: 4px; }
.header .tagline { font-size: ${isThermal ? "9px" : "10px"}; font-style: italic; opacity: 0.9; margin-bottom: 4px; }
.header .contact { font-size: ${isThermal ? "8.5px" : "9.5px"}; opacity: 0.95; letter-spacing: 0.2px; line-height: 1.4; }
.header .contact span { margin: 0 4px; }
.title-bar { background: ${isThermal ? "#ffffff" : "#eef2ff"}; color: #1e3a8a; text-align: center; font-weight: 700; letter-spacing: 1.5px; font-size: ${isThermal ? "11px" : "12px"}; padding: 6px 0; border-bottom: 1px ${isThermal ? "dashed #94a3b8" : "solid #c7d2fe"}; position: relative; z-index: 1; }
.body-pad { padding: ${isThermal ? "4mm" : "8mm"} ${sizeCss.padX} 0; position: relative; z-index: 1; }
.row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.row .label { color: #6b7280; font-weight: 600; min-width: ${isThermal ? "60px" : "80px"}; display: inline-block; }
.row .val { color: #111827; font-weight: 600; }
.divider { border: none; border-top: 1px ${isThermal ? "dashed #94a3b8" : "solid #e5e7eb"}; margin: 7px 0 9px; }
.member-block { margin: 6px 0 10px; }
.member-block .row { margin-bottom: 5px; }
table.items { width: 100%; border-collapse: collapse; margin: 6px 0 0; }
table.items thead th { background: ${isThermal ? "#ffffff" : "#1e3a8a"}; color: ${isThermal ? "#1e3a8a" : "#fff"}; padding: 6px 4px; font-size: ${isThermal ? "10px" : "10.5px"}; text-align: left; font-weight: 700; letter-spacing: 0.4px; border-bottom: 2px ${isThermal ? "dashed #94a3b8" : "solid #1e3a8a"}; }
table.items thead th.right { text-align: right; }
table.items tbody td { padding: 5px 4px; font-size: ${sizeCss.fontSize}; }
table.items tbody td.right { text-align: right; }
table.summary { width: 100%; border-collapse: collapse; margin-top: 4px; }
table.summary td { padding: 4px; font-size: ${sizeCss.fontSize}; }
table.summary td.right { text-align: right; }
table.summary tr.bold td { font-weight: 700; color: #0f172a; }
table.summary tr.net td { background: ${isThermal ? "transparent" : "#eef2ff"}; color: #1e3a8a; }
table.summary tr.neg td { color: #b45309; }
table.summary tr.sep td { border-top: 1px ${isThermal ? "dashed #94a3b8" : "solid #cbd5e1"}; padding: 0; height: 4px; }
.meta-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 4px 4px; font-size: ${sizeCss.fontSize}; }
.meta-row .method { color: #1e3a8a; font-weight: 600; }
.status-pill { font-weight: 700; letter-spacing: 0.6px; font-size: ${sizeCss.fontSize}; }
.remarks { font-style: italic; color: #6b7280; font-size: ${isThermal ? "9.5px" : "10px"}; padding: 0 4px 8px; }
.thanks { text-align: center; color: #b45309; font-style: italic; font-size: ${isThermal ? "10px" : "10.5px"}; margin-top: ${isThermal ? "8px" : "16px"}; }
.signature { text-align: right; padding: ${isThermal ? "10px" : "16px"} ${sizeCss.padX} 0; font-size: ${isThermal ? "9px" : "10px"}; color: #4b5563; ${isThermal ? "display:none;" : ""} }
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
<div class="title-bar">${titleText}</div>
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
  ${itemsTable}
  <table class="summary">${summaryRows}</table>
  <div class="meta-row">
    <span class="method">Payment Method: ${escHtml(o.paymentMethod || "Cash")}</span>
    <span class="status-pill" style="color:${statusColor}">${statusLabel}</span>
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
  /** Property/Company name (e.g. ".............") */
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

export function exportTableToCSV(headers: string[], rows: string[][], filename: string, meta?: CSVExportMeta) {
  const lines: string[] = [];
  if (meta) {
    if (meta.propertyName) lines.push(csvEscape(meta.propertyName));
    if (meta.reportTitle) lines.push(csvEscape(meta.reportTitle));
    if (meta.dateRange) lines.push(csvEscape(`Date: ${meta.dateRange}`));
    lines.push(csvEscape(`Generated: ${meta.generatedAt || formatDateTime(nowIso())}`));
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
    paperSize?: BillPaperSize;
    kind?: BillKind;
  },
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
    billForMonth: formatInTz(t.date, { month: "long", year: "numeric" }),
    items: [{ description: t.description, quantity: 1, rate: t.amount, amount: t.amount }],
    subtotal: t.amount,
    taxableAmount: t.amount,
    vatAmount: t.vat,
    grandTotal: t.total,
    paidAmount: t.total,
    paperSize: extras?.paperSize,
    kind: extras?.kind,
  });
}


export const handlePrintReport = (columns, rows, title, propertyName) => {
  const headerRow = `<tr>${columns.map((c) => `<th style="text-align:${c.align || "left"}">${c.label}</th>`).join("")}</tr>`;
  const bodyRows = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td style="text-align:${c.align || "left"}">${c.exportFormat ? c.exportFormat(r) : String(r[c.key] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
body { font-family: 'Helvetica', Arial, sans-serif; color: #0f172a; }
h1 { font-size: 18px; margin: 0 0 4px; color: #1e3a8a; }
.meta { color: #64748b; font-size: 11px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th { background: #1e3a8a; color: #fff; padding: 8px 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; font-size: 10px; }
td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
tr:nth-child(even) td { background: #f8fafc; }
</style></head><body>
<h1>${title}</h1>
<div class="meta">${propertyName || ""} · Generated ${formatDateTime(nowIso())}</div>
<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }
};
