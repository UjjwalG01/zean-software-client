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
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  vatNo?: string;
  guestName: string;
  billNo: string;
  billDate: string;
  billForMonth: string;
  items: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  luxuryTax?: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  attendant?: string;
}): string {
  const o = options;
  const inWords = numberToWords(Math.round(o.grandTotal)) + " Rupees only.";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${o.billNo}</title>
<style>
@page { size: A5; margin: 12mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; width: 148mm; }
.header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
.header h1 { font-size: 16px; font-weight: bold; }
.header p { font-size: 9px; }
.vat-no { position: absolute; right: 12mm; top: 12mm; font-size: 10px; }
.title { text-align: center; margin: 10px 0; font-weight: bold; font-size: 12px; text-decoration: underline; }
.info-grid { display: flex; justify-content: space-between; margin: 8px 0; }
.info-left, .info-right { font-size: 10px; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 10px; }
th { background: #f0f0f0; font-weight: bold; }
td.right, th.right { text-align: right; }
.totals { margin-left: auto; width: 55%; }
.totals td { border: none; padding: 2px 6px; font-size: 10px; }
.totals .grand { font-size: 12px; font-weight: bold; border-top: 2px solid #000; }
.in-words { margin: 8px 0; font-size: 10px; border: 1px solid #000; padding: 4px 8px; }
.footer { display: flex; justify-content: space-between; margin-top: 30px; font-size: 10px; }
.sig-line { border-top: 1px solid #000; width: 100px; text-align: center; padding-top: 4px; }
.thank-you { text-align: center; margin-top: 15px; font-size: 10px; font-weight: bold; }
</style></head><body>
<div class="vat-no">${o.vatNo ? `VAT: ${o.vatNo}` : ""}</div>
<div class="header">
  <h1>${o.companyName}</h1>
  ${o.companyAddress ? `<p>${o.companyAddress}</p>` : ""}
  ${o.companyPhone ? `<p>Phone: ${o.companyPhone}</p>` : ""}
  ${o.companyEmail ? `<p>Email: ${o.companyEmail}</p>` : ""}
</div>
<div class="title">INVOICE</div>
<div class="info-grid">
  <div class="info-left">
    <div>Guest Name: <strong>${o.guestName}</strong></div>
    <div>Bill For: <strong>${o.billForMonth}</strong></div>
  </div>
  <div class="info-right">
    <div>Bill No: <strong>${o.billNo}</strong></div>
    <div>Bill Date: <strong>${o.billDate}</strong></div>
  </div>
</div>
<table>
  <thead><tr><th>SN</th><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${o.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.description}</td><td class="right">${item.quantity.toFixed(2)}</td><td class="right">${item.rate.toFixed(2)}</td><td class="right">${item.amount.toFixed(2)}</td></tr>`).join("")}
  </tbody>
</table>
<table class="totals">
  <tr><td class="right">Sub Total</td><td class="right">${o.subtotal.toFixed(2)}</td></tr>
  ${o.luxuryTax ? `<tr><td class="right">2% Luxury Tax</td><td class="right">${o.luxuryTax.toFixed(2)}</td></tr>` : ""}
  <tr><td class="right">Taxable Amount</td><td class="right">${o.taxableAmount.toFixed(2)}</td></tr>
  <tr><td class="right">13% VAT</td><td class="right">${o.vatAmount.toFixed(2)}</td></tr>
  <tr class="grand"><td class="right"><strong>Grand Total (NPR)</strong></td><td class="right"><strong>${o.grandTotal.toFixed(2)}</strong></td></tr>
</table>
<div class="in-words"><strong>In Words:</strong> ${inWords}</div>
<div class="footer">
  <div>
    <div class="sig-line">${o.attendant || "admin"}</div>
    <div style="font-size:9px;margin-top:4px">TIME: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</div>
  </div>
  <div><div class="sig-line">Guest Signature</div></div>
</div>
<div class="thank-you">THANK YOU!</div>
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

export function exportTableToCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateReceiptHTML(t: Transaction, companyName: string): string {
  return generateA5BillHTML({
    companyName,
    guestName: t.memberName,
    billNo: t.receiptNo,
    billDate: t.date,
    billForMonth: new Date(t.date).toLocaleString("en", { month: "long", year: "numeric" }),
    items: [{ description: t.description, quantity: 1, rate: t.amount, amount: t.amount }],
    subtotal: t.amount,
    taxableAmount: t.amount,
    vatAmount: t.vat,
    grandTotal: t.total,
  });
}
