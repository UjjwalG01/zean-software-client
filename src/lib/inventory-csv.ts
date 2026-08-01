import type { InventoryItem, InventoryStore, ItemGroup, InventorySupplier } from "./inventory-store";

/** A single parsed CSV row, ready to be passed to `createItem`. */
export type ParsedItemDraft = Omit<InventoryItem, "id" | "createdAt">;

export interface CsvParseResult {
  drafts: ParsedItemDraft[];
  errors: string[];
  skipped: number;
}

/** Header aliases accepted by the importer (case/space insensitive). */
const FIELD_ALIASES: Record<string, string> = {
  name: "name",
  itemname: "name",
  code: "code",
  sku: "code",
  skucode: "code",
  description: "description",
  category: "group",
  group: "group",
  itemgroup: "group",
  unit: "unit",
  uom: "unit",
  unitofmeasure: "unit",
  quantity: "quantity",
  qty: "quantity",
  currentstock: "quantity",
  rate: "rate",
  price: "rate",
  reorderlevel: "reorderLevel",
  reorderpoint: "reorderLevel",
  reorderquantity: "reorderQuantity",
  reorderqty: "reorderQuantity",
  store: "store",
  location: "store",
  supplier: "supplier",
  active: "active",
  status: "active",
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split a single CSV line honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const toNumber = (value: string | undefined, fallback = 0): number => {
  if (!value) return fallback;
  const n = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

const matchByName = <T extends { id: string; name: string }>(list: T[], value?: string): T | undefined => {
  if (!value) return undefined;
  const q = value.trim().toLowerCase();
  return list.find((entry) => entry.name.trim().toLowerCase() === q);
};

/**
 * Parse a CSV export of the product catalog back into item drafts.
 * Category / Location / Supplier columns are resolved by name against the
 * existing masters; unknown names fall back to the first active master entry.
 */
export function parseItemsCsv(
  text: string,
  masters: { stores: InventoryStore[]; groups: ItemGroup[]; suppliers: InventorySupplier[] },
  existing: InventoryItem[],
): CsvParseResult {
  const errors: string[] = [];
  const drafts: ParsedItemDraft[] = [];
  let skipped = 0;

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { drafts, errors: ["CSV is empty or has no data rows."], skipped };
  }

  const headers = splitCsvLine(lines[0]).map((h) => FIELD_ALIASES[normalizeHeader(h)] ?? "");
  if (!headers.includes("name")) {
    return { drafts, errors: ["CSV must contain a 'Name' column."], skipped };
  }

  const fallbackStore = masters.stores.find((s) => s.active) ?? masters.stores[0];
  const fallbackGroup = masters.groups.find((g) => g.active) ?? masters.groups[0];
  const existingCodes = new Set(existing.map((i) => i.code.trim().toLowerCase()));
  const seenCodes = new Set<string>();

  lines.slice(1).forEach((line, index) => {
    const rowNo = index + 2;
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((field, i) => {
      if (field) row[field] = cells[i] ?? "";
    });

    const name = row.name?.trim();
    if (!name) {
      errors.push(`Row ${rowNo}: missing name — skipped.`);
      skipped += 1;
      return;
    }

    const code = (row.code?.trim() || name.slice(0, 3).toUpperCase() + rowNo).trim();
    const codeKey = code.toLowerCase();
    if (existingCodes.has(codeKey) || seenCodes.has(codeKey)) {
      errors.push(`Row ${rowNo}: code "${code}" already exists — skipped.`);
      skipped += 1;
      return;
    }
    seenCodes.add(codeKey);

    const store = matchByName(masters.stores, row.store) ?? fallbackStore;
    const group = matchByName(masters.groups, row.group) ?? fallbackGroup;
    if (!store || !group) {
      errors.push(`Row ${rowNo}: no store/category master available — skipped.`);
      skipped += 1;
      return;
    }
    const supplier = matchByName(masters.suppliers, row.supplier);
    if (row.supplier && !supplier) {
      errors.push(`Row ${rowNo}: supplier "${row.supplier}" not found — left blank.`);
    }

    const activeRaw = (row.active ?? "").trim().toLowerCase();
    const active = activeRaw === "" ? true : !["false", "no", "0", "inactive"].includes(activeRaw);

    drafts.push({
      code,
      name,
      description: row.description?.trim() || undefined,
      groupId: group.id,
      storeId: store.id,
      supplierId: supplier?.id,
      unit: row.unit?.trim() || "pcs",
      quantity: toNumber(row.quantity),
      rate: toNumber(row.rate),
      reorderLevel: toNumber(row.reorderLevel),
      reorderQuantity: toNumber(row.reorderQuantity),
      active,
    });
  });

  return { drafts, errors, skipped };
}

/** Downloadable template header matching the catalog export column order. */
export const ITEMS_CSV_TEMPLATE =
  "Name,SKU,Category,Unit,Quantity,Rate,Reorder Level,Reorder Quantity,Location,Supplier,Description,Active\n" +
  "Protein Bar,PB-001,Supplements,pcs,50,350,10,25,Main Store,Himalayan Foods,Chocolate flavour,true\n";
