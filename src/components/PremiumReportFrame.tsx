import { ReactNode, useState } from "react";
import { Filter, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportTableToCSV, type CSVExportMeta } from "@/lib/print-utils";
import { toast } from "sonner";

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
<div class="meta">${propertyName || ""} · Generated ${new Date().toLocaleString()}</div>
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
    <div className="rounded-xl overflow-hidden border border-border/60 bg-card">
      {/* Header band */}
      <div className="bg-gradient-to-r from-[hsl(220,70%,28%)] via-[hsl(220,70%,32%)] to-[hsl(220,70%,28%)] text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg leading-tight">
            {title}
          </h2>
          {subtitle && <p className="text-white/80 text-xs">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {filters && collapsibleFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters((p) => !p)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Filter className="h-4 w-4 mr-1.5" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={rows.length === 0}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="bg-success hover:bg-success/90 text-white"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filter strip */}
      {filters && (!collapsibleFilters || showFilters) && (
        <div className="bg-[hsl(214,100%,97%)] dark:bg-muted/20 px-5 py-4 border-b border-border/50">
          <p className="text-[11px] tracking-wider font-bold text-[hsl(220,70%,28%)] dark:text-primary mb-3">
            FILTERS
          </p>
          {filters}
        </div>
      )}

      {filterSummary && (
        <div className="px-5 py-3 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
          {filterSummary}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[hsl(220,70%,28%)] text-white">
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
                      className="border-b border-border/40 hover:bg-muted/30 even:bg-muted/10"
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
                  className="border-b border-border/40 hover:bg-muted/30 even:bg-muted/10"
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
              <tr className="bg-[hsl(220,70%,28%)]/10 dark:bg-primary/15 font-bold border-t-2 border-[hsl(220,70%,28%)]">
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
