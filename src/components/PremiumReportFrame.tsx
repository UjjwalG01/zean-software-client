import { ReactNode, useState } from "react";
import { formatDateTime, nowIso } from "@/lib/tz";
import { Filter, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportTableToCSV, type CSVExportMeta } from "@/lib/print-utils";
import { toast } from "sonner";
import {
  underlineFirstChar,
  underlineSpecificChars,
} from "@/lib/string-case-change";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
  voided?: (row: any) => boolean; // For conditional styling based on voided status
  format?: (row: any) => ReactNode;
  exportFormat?: (row: any) => string;
}

interface PremiumReportFrameProps {
  title: string;
  subtitle?: string;
  propertyName?: string;
  filters?: ReactNode;
  filterSummary?: ReactNode;
  columns: Column[];
  rows: any[];
  groupBy?: { key: string; label?: string; totals?: Column[] };
  footerTotals?: { label?: string; cells: Record<string, ReactNode> };
  emptyMessage?: string;
  exportFilename: string;
  exportMeta?: CSVExportMeta;
  collapsibleFilters?: boolean;
  /** Optional row-click handler that turns body rows into interactive items. */
  onRowClick?: (row: any) => void;
}

/**
 * Reusable premium-styled tabular report:
 * - Blue header banner with title + actions
 * - Collapsible filter strip on top
 * - Multi-row banded table with bold blue header
 * - CSV/Excel export + print
 */
export function PremiumReportFrame({
  title,
  subtitle,
  propertyName,
  filters,
  filterSummary,
  columns,
  rows,
  groupBy,
  footerTotals,
  emptyMessage = "No data to display.",
  exportFilename,
  exportMeta,
  collapsibleFilters = true,
  onRowClick,
}: PremiumReportFrameProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const data = rows.map((r) =>
      columns.map((c) => {
        if (c.exportFormat) return c.exportFormat(r);
        const v = r[c.key];
        return v === undefined || v === null ? "" : String(v);
      }),
    );
    exportTableToCSV(headers, data, exportFilename, {
      propertyName,
      reportTitle: title,
      ...(exportMeta || {}),
    });
    toast.success(`Exported ${rows.length} rows`);
  };

  const handlePrint = () => {
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

  // Optional grouping
  const grouped: Record<string, any[]> | null = groupBy
    ? rows.reduce((acc: Record<string, any[]>, r) => {
        const k = String(r[groupBy.key] ?? "—");
        (acc[k] = acc[k] || []).push(r);
        return acc;
      }, {})
    : null;

  return (
    <div className="glass-card rounded-xl overflow-hidden border border-border/60 bg-card">
      {/* Header band */}
      <div className=" px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 md:gap-3">
        <div>
          <h2 className="font-display font-bold text-sm md:text-lg leading-tight">
            {title}
          </h2>

          {filterSummary && (
            <div className="py-1 text-xs italic text-muted-foreground">
              {filterSummary}
            </div>
          )}
          {/* {subtitle && <p className="text-white/80 text-xs">{subtitle}</p>} */}
        </div>
        <div className="flex gap-2">
          {filters && collapsibleFilters && (
            <Button
              variant="outline"
              size="sm"
              accessKey={showFilters ? "h" : "l"}
              onClick={() => setShowFilters((p) => !p)}
              className="m-0.5"
            >
              <Filter className="h-4 w-4 mr-1.5 hidden md:flex" />
              {underlineFirstChar(showFilters ? "Hide Filters" : "Load Report")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            accessKey="p"
            onClick={handlePrint}
            disabled={rows.length === 0}
            className="text-pretty"
          >
            <Printer className="h-4 w-4 mr-1.5 hidden md:flex" />
            {underlineFirstChar("Print")}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            accessKey="x"
            disabled={rows.length === 0}
            className="bg-success hover:bg-success/90 text-white"
          >
            <Download className="h-4 w-4 mr-1.5 hidden md:flex" />
            {underlineSpecificChars("Export Excel", [1])}
          </Button>
        </div>
      </div>

      {/* Filter strip */}
      {filters && (!collapsibleFilters || showFilters) && (
        <div className="bg-[hsl(214,100%,97%)] dark:bg-muted/20 px-5 py-4 border-b border-border/50">
          {filters}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y-[1px]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-xs uppercase tracking-wider font-semibold",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    !c.align && "text-left",
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : grouped ? (
              Object.entries(grouped).map(([groupKey, groupRows]) => (
                <>
                  <tr
                    key={`g-${groupKey}`}
                    className="bg-[hsl(214,100%,94%)] dark:bg-primary/10"
                  >
                    <td
                      colSpan={columns.length}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[hsl(220,70%,28%)] dark:text-primary"
                    >
                      {groupBy?.label ? `${groupBy.label}: ` : ""}
                      {groupKey}{" "}
                      <span className="opacity-60 font-normal normal-case">
                        ({groupRows.length})
                      </span>
                    </td>
                  </tr>
                  {groupRows.map((r, i) => (
                    <tr
                      key={`${groupKey}-${i}`}
                      onClick={onRowClick ? () => onRowClick(r) : undefined}
                      className={cn(
                        "border-b border-border/40 even:bg-muted/10 transition-colors",
                        onRowClick
                          ? "cursor-pointer hover:bg-muted/60"
                          : "hover:bg-muted/30",
                      )}
                    >
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "px-4 py-2.5",
                            c.align === "right" && "text-right",
                            c.align === "center" && "text-center",
                          )}
                        >
                          {c.format ? c.format(r) : (r[c.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(
                    "border-b border-border/40 even:bg-muted/10 transition-colors",
                    onRowClick
                      ? "cursor-pointer hover:bg-muted/60"
                      : "hover:bg-muted/30",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-2.5",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                      )}
                    >
                      {c.format ? c.format(r) : (r[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {footerTotals && rows.length > 0 && (
              <tr className="glass-card">
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {i === 0
                      ? footerTotals.label || "Total"
                      : (footerTotals.cells[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
