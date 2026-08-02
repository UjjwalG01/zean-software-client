// Inventory store — Supabase backend (replaces the localStorage implementation).
// Keeps the same exported API so existing hooks/pages keep working, and adds
// suppliers, a global movement ledger, adjustments and store transfers.
// Falls back to localStorage for fully offline / unauthenticated demo sessions.

import { supabase } from "./supabase";
import { logAudit } from "./audit-log";
import { getSystemTimestamp } from "./timeUtils";

export type InventoryStore = { id: string; name: string; location?: string; active: boolean };
export type ItemGroup = { id: string; name: string; description?: string; active: boolean };
export type InventorySupplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  active: boolean;
};

/** Ledger movement kinds. `purchase` = received, `issue` = issued/shipped. */
export type MovementType = "opening" | "purchase" | "issue" | "adjustment" | "transfer";

/** Movement types that increase stock. */
export const INBOUND_TYPES: MovementType[] = ["opening", "purchase"];

export type InventoryItem = {
  id: string;
  code: string;
  name: string;
  description?: string;
  groupId: string;
  storeId: string;
  supplierId?: string;
  unit: string;
  quantity: number;
  rate: number;
  reorderLevel: number;
  reorderQuantity: number;
  active: boolean;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  rate: number;
  reference?: string;
  note?: string;
  supplierId?: string;
  fromStoreId?: string;
  toStoreId?: string;
  performedByName?: string;
  balanceAfter?: number;
  createdBy?: string;
  createdAt: string;
};

/** Signed direction of a movement: `in` adds stock, `out` removes it. */
export function movementDirection(m: Pick<StockMovement, "type" | "quantity">): "in" | "out" {
  if (m.type === "issue") return "out";
  if (m.type === "adjustment") return m.quantity >= 0 ? "in" : "out";
  return "in";
}

/** Human label for a movement type, matching the reference UI wording. */
export const MOVEMENT_LABEL: Record<MovementType, string> = {
  opening: "Opening",
  purchase: "Received",
  issue: "Issued",
  adjustment: "Adjusted",
  transfer: "Transferred",
};

// ───── Module-level caches (sync API expected by the hook) ────────────────
let _stores: InventoryStore[] = [];
let _groups: ItemGroup[] = [];
let _suppliers: InventorySupplier[] = [];
let _items: InventoryItem[] = [];
const _movByItem = new Map<string, StockMovement[]>();
let _loaded = false;
let _seeded = false;

const LS = {
  stores: "inv:stores",
  groups: "inv:groups",
  suppliers: "inv:suppliers",
  items: "inv:items",
  movements: "inv:movements",
  seeded: "inv:seeded:v1",
};

function lsRead<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; }
}
function lsWrite<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

// ───── Mappers ────────────────────────────────────────────────────────────
const mapStore = (r: any): InventoryStore => ({ id: r.id, name: r.name, location: r.location || "", active: r.active !== false });
const mapGroup = (r: any): ItemGroup => ({ id: r.id, name: r.name, description: r.description || "", active: r.active !== false });
const mapSupplier = (r: any): InventorySupplier => ({
  id: r.id, name: r.name,
  contactPerson: r.contact_person || "", phone: r.phone || "",
  email: r.email || "", address: r.address || "",
  active: r.active !== false,
});
const mapItem = (r: any): InventoryItem => ({
  id: r.id, code: r.code, name: r.name,
  description: r.description || "",
  groupId: r.group_id || "", storeId: r.store_id || "",
  supplierId: r.supplier_id || "",
  unit: r.unit || "pcs", quantity: Number(r.quantity || 0), rate: Number(r.rate || 0),
  reorderLevel: Number(r.reorder_level || 0),
  reorderQuantity: Number(r.reorder_quantity || 0),
  active: r.active !== false,
  createdAt: r.created_at || getSystemTimestamp(),
});
const mapMov = (r: any): StockMovement => ({
  id: r.id, itemId: r.item_id, type: r.type as MovementType,
  quantity: Number(r.quantity), rate: Number(r.rate || 0),
  reference: r.reference || "", note: r.note || "",
  supplierId: r.supplier_id || undefined,
  fromStoreId: r.from_store_id || undefined,
  toStoreId: r.to_store_id || undefined,
  performedByName: r.performed_by_name || undefined,
  balanceAfter: r.balance_after === null || r.balance_after === undefined ? undefined : Number(r.balance_after),
  createdBy: r.created_by || undefined, createdAt: r.created_at,
});

// ───── Bootstrap: load from Supabase or fall back to localStorage ─────────
export async function loadInventory(): Promise<void> {
  if (_loaded) return;
  try {
    const [s, g, i, sup] = await Promise.all([
      supabase.from("inv_stores").select("*").order("name"),
      supabase.from("inv_item_groups").select("*").order("name"),
      supabase.from("inv_items").select("*").order("name"),
      supabase.from("inv_suppliers").select("*").order("name"),
    ]);
    if (!s.error && !g.error && !i.error) {
      _stores = (s.data || []).map(mapStore);
      _groups = (g.data || []).map(mapGroup);
      _items = (i.data || []).map(mapItem);
      _suppliers = sup.error ? [] : (sup.data || []).map(mapSupplier);
      _loaded = true;
      if (_stores.length === 0 && _groups.length === 0 && _items.length === 0) {
        // First-run: seed defaults into the database.
        await seedDefaultsInDb();
        await reloadAll();
      }
      return;
    }
    throw s.error || g.error || i.error;
  } catch (e) {
    console.warn("[inventory] Supabase load failed — using localStorage fallback:", (e as Error).message);
    _stores = lsRead<InventoryStore[]>(LS.stores, []);
    _groups = lsRead<ItemGroup[]>(LS.groups, []);
    _suppliers = lsRead<InventorySupplier[]>(LS.suppliers, []);
    _items = lsRead<InventoryItem[]>(LS.items, []);
    const movs = lsRead<StockMovement[]>(LS.movements, []);
    _movByItem.clear();
    for (const m of movs) {
      const arr = _movByItem.get(m.itemId) || [];
      arr.push(m); _movByItem.set(m.itemId, arr);
    }
    _loaded = true;
    if (!localStorage.getItem(LS.seeded) && _stores.length === 0) seedLocal();
  }
}

async function reloadAll() {
  const [s, g, i, sup] = await Promise.all([
    supabase.from("inv_stores").select("*").order("name"),
    supabase.from("inv_item_groups").select("*").order("name"),
    supabase.from("inv_items").select("*").order("name"),
    supabase.from("inv_suppliers").select("*").order("name"),
  ]);
  _stores = (s.data || []).map(mapStore);
  _groups = (g.data || []).map(mapGroup);
  _items = (i.data || []).map(mapItem);
  _suppliers = sup.error ? _suppliers : (sup.data || []).map(mapSupplier);
}

async function seedDefaultsInDb() {
  const stores = [
    { name: "Main Store", location: "Ground Floor" },
    { name: "Spa Store", location: "First Floor" },
    { name: "Cafe & F&B", location: "Lobby" },
  ];
  const groups = [
    { name: "Supplements" }, { name: "Spa Products" },
    { name: "Beverages" }, { name: "Gym Equipment" },
  ];
  await supabase.from("inv_stores").insert(stores);
  await supabase.from("inv_item_groups").insert(groups);
}

function seedLocal() {
  _stores = [
    { id: rid(), name: "Main Store", location: "Ground Floor", active: true },
    { id: rid(), name: "Spa Store", location: "First Floor", active: true },
    { id: rid(), name: "Cafe & F&B", location: "Lobby", active: true },
  ];
  _groups = [
    { id: rid(), name: "Supplements", active: true },
    { id: rid(), name: "Spa Products", active: true },
    { id: rid(), name: "Beverages", active: true },
    { id: rid(), name: "Gym Equipment", active: true },
  ];
  _items = []; _suppliers = []; _movByItem.clear();
  persistLocal();
  localStorage.setItem(LS.seeded, "1");
}

function persistLocal() {
  lsWrite(LS.stores, _stores); lsWrite(LS.groups, _groups); lsWrite(LS.items, _items);
  lsWrite(LS.suppliers, _suppliers);
  const all: StockMovement[] = [];
  _movByItem.forEach((arr) => arr.forEach((m) => all.push(m)));
  lsWrite(LS.movements, all);
}

const rid = () => Math.random().toString(36).slice(2, 10);
const now = () => getSystemTimestamp();

/** Back-compat shim — older code triggers seeding via this name. */
export function seedInventoryIfEmpty() {
  if (_seeded) return; _seeded = true;
  // Kick the async loader without blocking. The hook below awaits load() too.
  loadInventory().catch(() => {});
}

// ───── Sync getters (consumed by the hook layer) ──────────────────────────
export const getStores = (): InventoryStore[] => _stores;
export const getGroups = (): ItemGroup[] => _groups;
export const getSuppliers = (): InventorySupplier[] => _suppliers;
export const getItems = (): InventoryItem[] => _items;
export const getItem = (id: string) => _items.find((i) => i.id === id);

/**
 * Suggest the next item code in the form `ITM-0001` based on existing items.
 * Falls back to `ITM-0001` if no numbered codes are found.
 */
export function nextItemCode(prefix = "ITM-"): string {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}?(\\d+)$`, "i");
  let max = 0;
  for (const it of _items) {
    const m = (it.code || "").match(re) || (it.code || "").match(/^(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export const getMovements = (): StockMovement[] => {
  const all: StockMovement[] = [];
  _movByItem.forEach((arr) => all.push(...arr));
  return all;
};
export const getMovementsByItem = (itemId: string): StockMovement[] =>
  (_movByItem.get(itemId) || []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/**
 * Global movement ledger, newest first. Reads from Supabase when reachable and
 * always merges the local cache so offline sessions still show their history.
 */
export async function listAllMovements(opts: {
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<StockMovement[]> {
  try {
    let q = supabase
      .from("inv_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 500);
    if (opts.from) q = q.gte("created_at", opts.from);
    if (opts.to) q = q.lte("created_at", opts.to);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []).map(mapMov);
    // Refresh per-item cache so the drawer stays consistent.
    _movByItem.clear();
    for (const m of rows) {
      const arr = _movByItem.get(m.itemId) || [];
      arr.push(m); _movByItem.set(m.itemId, arr);
    }
    return rows;
  } catch (e) {
    console.warn("[inventory] movement ledger read failed:", (e as Error).message);
    return getMovements().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

// ───── Mutations (write-through to Supabase, refresh local cache) ─────────
/**
 * Strips keys the database does not know about yet (e.g. when the v2 inventory
 * migration has not been applied) so writes degrade instead of failing.
 */
function stripUnknownColumn(payload: any, message: string): any | null {
  const m = message.match(/column "?([a-z_]+)"?/i) || message.match(/'([a-z_]+)' column/i);
  const col = m?.[1];
  if (!col || !(col in payload)) return null;
  const { [col]: _drop, ...rest } = payload;
  console.warn(`[inventory] column "${col}" missing in DB — retrying without it. Run the inventory v2 migration.`);
  return rest;
}

async function dbInsert<T>(table: string, payload: any): Promise<T | null> {
  let body = payload;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase.from(table).insert(body).select("*").single();
    if (!error) return data as T;
    const retry = /column|schema cache/i.test(error.message) ? stripUnknownColumn(body, error.message) : null;
    if (!retry) { console.warn(`[inventory] insert ${table} failed:`, error.message); return null; }
    body = retry;
  }
  return null;
}
async function dbUpdate(table: string, id: string, patch: any): Promise<void> {
  let body = patch;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase.from(table).update(body).eq("id", id);
    if (!error) return;
    const retry = /column|schema cache/i.test(error.message) ? stripUnknownColumn(body, error.message) : null;
    if (!retry) { console.warn(`[inventory] update ${table} failed:`, error.message); return; }
    body = retry;
  }
}

async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.warn(`[inventory] delete ${table} failed:`, error.message);
}

function audit(action: string, entityId: string | undefined, newValue: any, oldValue?: any) {
  void logAudit({
    module: "Inventory",
    moduleSlug: "inventory",
    entityType: "inventory_item",
    action,
    entityId,
    oldValue,
    newValue,
  });
}

export async function saveStore(s: Omit<InventoryStore, "id"> & { id?: string }): Promise<InventoryStore> {
  if (s.id) {
    await dbUpdate("inv_stores", s.id, { name: s.name, location: s.location || null, active: s.active });
    const idx = _stores.findIndex((x) => x.id === s.id);
    if (idx >= 0) _stores[idx] = { ..._stores[idx], ...s } as InventoryStore;
  } else {
    const row = await dbInsert<any>("inv_stores", { name: s.name, location: s.location || null, active: s.active });
    if (row) _stores.push(mapStore(row));
    else { const local = { ...s, id: rid() } as InventoryStore; _stores.push(local); }
  }
  persistLocal();
  return _stores[_stores.length - 1];
}
export async function deleteStore(id: string) {
  // Block deletion if any items reference this store.
  let linkedItems = _items.filter((i) => i.storeId === id).length;
  try {
    const { count } = await supabase
      .from("inv_items")
      .select("id", { count: "exact", head: true })
      .eq("store_id", id);
    if (typeof count === "number") linkedItems = Math.max(linkedItems, count);
  } catch { /* use local count */ }
  if (linkedItems > 0) {
    throw new Error("Cannot delete this store — it has items linked to it. Move or delete those items first.");
  }
  await dbDelete("inv_stores", id);
  _stores = _stores.filter((s) => s.id !== id); persistLocal();
}

export async function saveGroup(g: Omit<ItemGroup, "id"> & { id?: string }): Promise<ItemGroup> {
  if (g.id) {
    await dbUpdate("inv_item_groups", g.id, { name: g.name, description: g.description || null, active: g.active });
    const idx = _groups.findIndex((x) => x.id === g.id);
    if (idx >= 0) _groups[idx] = { ..._groups[idx], ...g } as ItemGroup;
  } else {
    const row = await dbInsert<any>("inv_item_groups", { name: g.name, description: g.description || null, active: g.active });
    if (row) _groups.push(mapGroup(row));
    else { const local = { ...g, id: rid() } as ItemGroup; _groups.push(local); }
  }
  persistLocal();
  return _groups[_groups.length - 1];
}
export async function deleteGroup(id: string) {
  let linkedItems = _items.filter((i) => i.groupId === id).length;
  try {
    const { count } = await supabase
      .from("inv_items")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id);
    if (typeof count === "number") linkedItems = Math.max(linkedItems, count);
  } catch { /* use local count */ }
  if (linkedItems > 0) {
    throw new Error("Cannot delete this group — items are assigned to it. Reassign or remove those items first.");
  }
  await dbDelete("inv_item_groups", id);
  _groups = _groups.filter((g) => g.id !== id); persistLocal();
}

// ───── Suppliers ──────────────────────────────────────────────────────────
export async function saveSupplier(s: Omit<InventorySupplier, "id"> & { id?: string }): Promise<InventorySupplier> {
  const payload = {
    name: s.name,
    contact_person: s.contactPerson || null,
    phone: s.phone || null,
    email: s.email || null,
    address: s.address || null,
    active: s.active,
  };
  if (s.id) {
    await dbUpdate("inv_suppliers", s.id, payload);
    const idx = _suppliers.findIndex((x) => x.id === s.id);
    if (idx >= 0) _suppliers[idx] = { ..._suppliers[idx], ...s } as InventorySupplier;
    audit("update", s.id, { supplier: s.name });
  } else {
    const row = await dbInsert<any>("inv_suppliers", payload);
    if (row) _suppliers.push(mapSupplier(row));
    else _suppliers.push({ ...s, id: rid() } as InventorySupplier);
    audit("create", _suppliers[_suppliers.length - 1]?.id, { supplier: s.name });
  }
  persistLocal();
  return _suppliers[_suppliers.length - 1];
}

export async function deleteSupplier(id: string) {
  let linked = _items.filter((i) => i.supplierId === id).length;
  try {
    const { count } = await supabase
      .from("inv_items")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", id);
    if (typeof count === "number") linked = Math.max(linked, count);
  } catch { /* use local count */ }
  if (linked > 0) {
    throw new Error("Cannot delete this supplier — items are assigned to it. Reassign those items first.");
  }
  await dbDelete("inv_suppliers", id);
  _suppliers = _suppliers.filter((s) => s.id !== id);
  audit("delete", id, { supplier: id });
  persistLocal();
}

// ───── Items ──────────────────────────────────────────────────────────────
export async function createItem(payload: Omit<InventoryItem, "id" | "createdAt">): Promise<InventoryItem> {
  const row = await dbInsert<any>("inv_items", {
    code: payload.code, name: payload.name,
    description: payload.description || null,
    group_id: payload.groupId || null, store_id: payload.storeId || null,
    supplier_id: payload.supplierId || null,
    unit: payload.unit, quantity: payload.quantity, rate: payload.rate,
    reorder_level: payload.reorderLevel,
    reorder_quantity: payload.reorderQuantity ?? 0,
    active: payload.active,
  });
  const item: InventoryItem = row ? mapItem(row) : { ...payload, id: rid(), createdAt: now() };
  _items.push(item);
  if (item.quantity > 0) {
    await addMovement({
      itemId: item.id, type: "opening", quantity: item.quantity,
      rate: item.rate, note: "Opening balance", balanceAfter: item.quantity,
    });
  }
  audit("create", item.id, { code: item.code, name: item.name, quantity: item.quantity, rate: item.rate });
  persistLocal();
  return item;
}

export async function updateItem(id: string, patch: Partial<InventoryItem>) {
  const dbPatch: any = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.code !== undefined) dbPatch.code = patch.code;
  if (patch.description !== undefined) dbPatch.description = patch.description || null;
  if (patch.groupId !== undefined) dbPatch.group_id = patch.groupId || null;
  if (patch.storeId !== undefined) dbPatch.store_id = patch.storeId || null;
  if (patch.supplierId !== undefined) dbPatch.supplier_id = patch.supplierId || null;
  if (patch.unit !== undefined) dbPatch.unit = patch.unit;
  if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
  if (patch.rate !== undefined) dbPatch.rate = patch.rate;
  if (patch.reorderLevel !== undefined) dbPatch.reorder_level = patch.reorderLevel;
  if (patch.reorderQuantity !== undefined) dbPatch.reorder_quantity = patch.reorderQuantity;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (Object.keys(dbPatch).length) await dbUpdate("inv_items", id, dbPatch);
  const idx = _items.findIndex((x) => x.id === id);
  if (idx >= 0) _items[idx] = { ..._items[idx], ...patch };
  persistLocal();
}

/** Item edit initiated from the UI — same as `updateItem` but audited. */
export async function editItem(id: string, patch: Partial<InventoryItem>) {
  const before = getItem(id);
  await updateItem(id, patch);
  audit("update", id, patch, before ? { name: before.name, quantity: before.quantity, rate: before.rate } : undefined);
}

export async function deleteItem(id: string) {
  // Protect items that have any stock movements (purchases, issues, opening balances).
  const movs = _movByItem.get(id) || [];
  let dbCount = 0;
  try {
    const { count } = await supabase.from("inv_movements").select("id", { count: "exact", head: true }).eq("item_id", id);
    dbCount = count || 0;
  } catch { /* fall back to local count */ }
  if (movs.length > 0 || dbCount > 0) {
    throw new Error("Cannot delete this item — it has stock movements (purchase/issue) linked to it. Mark it inactive instead.");
  }
  const before = getItem(id);
  await dbDelete("inv_items", id);
  _items = _items.filter((i) => i.id !== id);
  _movByItem.delete(id);
  audit("delete", id, { name: before?.name, code: before?.code });
  persistLocal();
}

// ───── Movements ──────────────────────────────────────────────────────────
async function currentActorName(): Promise<string | undefined> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return undefined;
    const { data } = await supabase
      .from("app_users")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    return (data as any)?.display_name || user.email || undefined;
  } catch {
    return undefined;
  }
}

export async function addMovement(
  m: Omit<StockMovement, "id" | "createdAt">,
): Promise<StockMovement> {
  const performedByName = m.performedByName || (await currentActorName());
  const row = await dbInsert<any>("inv_movements", {
    item_id: m.itemId, type: m.type, quantity: m.quantity, rate: m.rate,
    reference: m.reference || null, note: m.note || null,
    supplier_id: m.supplierId || null,
    from_store_id: m.fromStoreId || null,
    to_store_id: m.toStoreId || null,
    performed_by_name: performedByName || null,
    balance_after: m.balanceAfter ?? null,
  });
  const mv: StockMovement = row
    ? mapMov(row)
    : { ...m, performedByName, id: rid(), createdAt: now() };
  const arr = _movByItem.get(mv.itemId) || [];
  arr.push(mv); _movByItem.set(mv.itemId, arr);
  persistLocal();

  const item = getItem(mv.itemId);
  audit(`stock-${mv.type}`, mv.itemId, {
    item: item?.name,
    code: item?.code,
    type: mv.type,
    quantity: mv.quantity,
    rate: mv.rate,
    reference: mv.reference || null,
    balanceAfter: mv.balanceAfter ?? null,
  });
  return mv;
}

export async function purchaseStock(
  itemId: string, qty: number, rate: number,
  reference?: string, note?: string, supplierId?: string,
) {
  const item = getItem(itemId);
  if (!item || qty <= 0) return;
  const newQty = item.quantity + qty;
  const newRate = newQty > 0
    ? Math.round((((item.quantity * item.rate) + (qty * rate)) / newQty) * 100) / 100
    : rate;
  await updateItem(itemId, { quantity: newQty, rate: newRate });
  await addMovement({
    itemId, type: "purchase", quantity: qty, rate,
    reference, note, supplierId: supplierId || item.supplierId,
    toStoreId: item.storeId, balanceAfter: newQty,
  });
}

export async function issueStock(itemId: string, qty: number, reference?: string, note?: string) {
  const item = getItem(itemId);
  if (!item || qty <= 0) return;
  const take = Math.min(item.quantity, qty);
  const balance = item.quantity - take;
  await updateItem(itemId, { quantity: balance });
  await addMovement({
    itemId, type: "issue", quantity: take, rate: item.rate,
    reference, note, fromStoreId: item.storeId, balanceAfter: balance,
  });
}

/**
 * Manual stock correction. `delta` may be positive (found stock) or negative
 * (shrinkage/damage). The reason is stored as the movement note.
 */
export async function adjustStock(itemId: string, delta: number, reason?: string, reference?: string) {
  const item = getItem(itemId);
  if (!item || !delta) return;
  const balance = Math.max(0, item.quantity + delta);
  await updateItem(itemId, { quantity: balance });
  await addMovement({
    itemId, type: "adjustment", quantity: delta, rate: item.rate,
    reference, note: reason, balanceAfter: balance,
  });
}

/**
 * Move stock between stores. The item's `store_id` is repointed when the whole
 * quantity is transferred; partial transfers are recorded as a ledger entry
 * against the destination store.
 */
export async function transferStock(
  itemId: string, toStoreId: string, qty: number,
  reference?: string, note?: string,
) {
  const item = getItem(itemId);
  if (!item || qty <= 0 || !toStoreId || toStoreId === item.storeId) return;
  const move = Math.min(item.quantity, qty);
  const patch: Partial<InventoryItem> = move >= item.quantity ? { storeId: toStoreId } : {};
  if (Object.keys(patch).length) await updateItem(itemId, patch);
  await addMovement({
    itemId, type: "transfer", quantity: move, rate: item.rate,
    reference, note, fromStoreId: item.storeId, toStoreId,
    balanceAfter: item.quantity,
  });
}

// ───── Aggregates ─────────────────────────────────────────────────────────
export const itemValuation = (i: InventoryItem) => i.quantity * i.rate;
export const totalValuation = () => getItems().reduce((s, i) => s + itemValuation(i), 0);
export const lowStockCount = () => getItems().filter((i) => i.active && i.quantity <= i.reorderLevel).length;

/** Stock status bucket used by the catalog badge and the analytics donut. */
export function stockStatus(i: Pick<InventoryItem, "quantity" | "reorderLevel">): "in" | "low" | "out" {
  if (i.quantity <= 0) return "out";
  if (i.quantity <= i.reorderLevel) return "low";
  return "in";
}
