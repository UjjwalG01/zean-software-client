// Inventory store — Supabase backend (replaces the localStorage implementation).
// Keeps the same exported API so the existing hook (`use-inventory.ts`) and
// pages keep working without changes. Falls back to localStorage for fully
// offline / unauthenticated demo sessions.

import { supabase } from "./supabase";

export type InventoryStore = { id: string; name: string; location?: string; active: boolean };
export type ItemGroup     = { id: string; name: string; description?: string; active: boolean };
export type MovementType  = "opening" | "purchase" | "issue" | "adjustment";

export type InventoryItem = {
  id: string;
  code: string;
  name: string;
  groupId: string;
  storeId: string;
  unit: string;
  quantity: number;
  rate: number;
  reorderLevel: number;
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
  createdBy?: string;
  createdAt: string;
};

// ───── Module-level caches (sync API expected by the hook) ────────────────
let _stores: InventoryStore[] = [];
let _groups: ItemGroup[] = [];
let _items: InventoryItem[] = [];
const _movByItem = new Map<string, StockMovement[]>();
let _loaded = false;
let _seeded = false;

const LS = {
  stores: "inv:stores",
  groups: "inv:groups",
  items:  "inv:items",
  movements: "inv:movements",
  seeded: "inv:seeded:v1",
};

function lsRead<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; }
}
function lsWrite<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

// ───── Mappers ────────────────────────────────────────────────────────────
const mapStore = (r: any): InventoryStore => ({ id: r.id, name: r.name, location: r.location || "", active: r.active !== false });
const mapGroup = (r: any): ItemGroup     => ({ id: r.id, name: r.name, description: r.description || "", active: r.active !== false });
const mapItem  = (r: any): InventoryItem => ({
  id: r.id, code: r.code, name: r.name,
  groupId: r.group_id || "", storeId: r.store_id || "",
  unit: r.unit || "pcs", quantity: Number(r.quantity || 0), rate: Number(r.rate || 0),
  reorderLevel: Number(r.reorder_level || 0), active: r.active !== false,
  createdAt: r.created_at || new Date().toISOString(),
});
const mapMov = (r: any): StockMovement => ({
  id: r.id, itemId: r.item_id, type: r.type as MovementType,
  quantity: Number(r.quantity), rate: Number(r.rate || 0),
  reference: r.reference || "", note: r.note || "",
  createdBy: r.created_by || undefined, createdAt: r.created_at,
});

// ───── Bootstrap: load from Supabase or fall back to localStorage ─────────
export async function loadInventory(): Promise<void> {
  if (_loaded) return;
  try {
    const [s, g, i] = await Promise.all([
      supabase.from("inv_stores").select("*").order("name"),
      supabase.from("inv_item_groups").select("*").order("name"),
      supabase.from("inv_items").select("*").order("name"),
    ]);
    if (!s.error && !g.error && !i.error) {
      _stores = (s.data || []).map(mapStore);
      _groups = (g.data || []).map(mapGroup);
      _items  = (i.data || []).map(mapItem);
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
    _items  = lsRead<InventoryItem[]>(LS.items, []);
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
  const [s, g, i] = await Promise.all([
    supabase.from("inv_stores").select("*").order("name"),
    supabase.from("inv_item_groups").select("*").order("name"),
    supabase.from("inv_items").select("*").order("name"),
  ]);
  _stores = (s.data || []).map(mapStore);
  _groups = (g.data || []).map(mapGroup);
  _items  = (i.data || []).map(mapItem);
}

async function seedDefaultsInDb() {
  const stores = [
    { name: "Main Store", location: "Ground Floor" },
    { name: "Spa Store",  location: "First Floor" },
    { name: "Cafe & F&B", location: "Lobby" },
  ];
  const groups = [
    { name: "Supplements" }, { name: "Spa Products" },
    { name: "Beverages" },   { name: "Gym Equipment" },
  ];
  await supabase.from("inv_stores").insert(stores);
  await supabase.from("inv_item_groups").insert(groups);
}

function seedLocal() {
  _stores = [
    { id: rid(), name: "Main Store", location: "Ground Floor", active: true },
    { id: rid(), name: "Spa Store",  location: "First Floor",  active: true },
    { id: rid(), name: "Cafe & F&B", location: "Lobby",        active: true },
  ];
  _groups = [
    { id: rid(), name: "Supplements", active: true },
    { id: rid(), name: "Spa Products", active: true },
    { id: rid(), name: "Beverages", active: true },
    { id: rid(), name: "Gym Equipment", active: true },
  ];
  _items = []; _movByItem.clear();
  persistLocal();
  localStorage.setItem(LS.seeded, "1");
}

function persistLocal() {
  lsWrite(LS.stores, _stores); lsWrite(LS.groups, _groups); lsWrite(LS.items, _items);
  const all: StockMovement[] = [];
  _movByItem.forEach((arr) => arr.forEach((m) => all.push(m)));
  lsWrite(LS.movements, all);
}

const rid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

/** Back-compat shim — older code triggers seeding via this name. */
export function seedInventoryIfEmpty() {
  if (_seeded) return; _seeded = true;
  // Kick the async loader without blocking. The hook below awaits load() too.
  loadInventory().catch(() => {});
}

// ───── Sync getters (consumed by the hook layer) ──────────────────────────
export const getStores    = (): InventoryStore[] => _stores;
export const getGroups    = (): ItemGroup[]     => _groups;
export const getItems     = (): InventoryItem[] => _items;
export const getItem      = (id: string)        => _items.find((i) => i.id === id);
export const getMovements = (): StockMovement[] => {
  const all: StockMovement[] = [];
  _movByItem.forEach((arr) => all.push(...arr));
  return all;
};
export const getMovementsByItem = (itemId: string): StockMovement[] =>
  (_movByItem.get(itemId) || []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));

// ───── Mutations (write-through to Supabase, refresh local cache) ─────────
async function dbInsert<T>(table: string, payload: any): Promise<T | null> {
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();
  if (error) { console.warn(`[inventory] insert ${table} failed:`, error.message); return null; }
  return data as T;
}
async function dbUpdate(table: string, id: string, patch: any): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) console.warn(`[inventory] update ${table} failed:`, error.message);
}
async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.warn(`[inventory] delete ${table} failed:`, error.message);
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
  await dbDelete("inv_item_groups", id);
  _groups = _groups.filter((g) => g.id !== id); persistLocal();
}

export async function createItem(payload: Omit<InventoryItem, "id" | "createdAt">): Promise<InventoryItem> {
  const row = await dbInsert<any>("inv_items", {
    code: payload.code, name: payload.name,
    group_id: payload.groupId || null, store_id: payload.storeId || null,
    unit: payload.unit, quantity: payload.quantity, rate: payload.rate,
    reorder_level: payload.reorderLevel, active: payload.active,
  });
  const item: InventoryItem = row ? mapItem(row) : { ...payload, id: rid(), createdAt: now() };
  _items.push(item);
  if (item.quantity > 0) {
    await addMovement({ itemId: item.id, type: "opening", quantity: item.quantity, rate: item.rate, note: "Opening balance" });
  }
  persistLocal();
  return item;
}

export async function updateItem(id: string, patch: Partial<InventoryItem>) {
  const dbPatch: any = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.code !== undefined) dbPatch.code = patch.code;
  if (patch.groupId !== undefined) dbPatch.group_id = patch.groupId || null;
  if (patch.storeId !== undefined) dbPatch.store_id = patch.storeId || null;
  if (patch.unit !== undefined) dbPatch.unit = patch.unit;
  if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
  if (patch.rate !== undefined) dbPatch.rate = patch.rate;
  if (patch.reorderLevel !== undefined) dbPatch.reorder_level = patch.reorderLevel;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (Object.keys(dbPatch).length) await dbUpdate("inv_items", id, dbPatch);
  const idx = _items.findIndex((x) => x.id === id);
  if (idx >= 0) _items[idx] = { ..._items[idx], ...patch };
  persistLocal();
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
  await dbDelete("inv_items", id);
  _items = _items.filter((i) => i.id !== id);
  _movByItem.delete(id);
  persistLocal();
}

export async function addMovement(m: Omit<StockMovement, "id" | "createdAt">): Promise<StockMovement> {
  const row = await dbInsert<any>("inv_movements", {
    item_id: m.itemId, type: m.type, quantity: m.quantity, rate: m.rate,
    reference: m.reference || null, note: m.note || null,
  });
  const mv: StockMovement = row ? mapMov(row) : { ...m, id: rid(), createdAt: now() };
  const arr = _movByItem.get(mv.itemId) || [];
  arr.push(mv); _movByItem.set(mv.itemId, arr);
  persistLocal();
  return mv;
}

export async function purchaseStock(itemId: string, qty: number, rate: number, reference?: string, note?: string) {
  const item = getItem(itemId);
  if (!item || qty <= 0) return;
  const newQty = item.quantity + qty;
  const newRate = newQty > 0
    ? Math.round((((item.quantity * item.rate) + (qty * rate)) / newQty) * 100) / 100
    : rate;
  await updateItem(itemId, { quantity: newQty, rate: newRate });
  await addMovement({ itemId, type: "purchase", quantity: qty, rate, reference, note });
}

export async function issueStock(itemId: string, qty: number, reference?: string, note?: string) {
  const item = getItem(itemId);
  if (!item || qty <= 0) return;
  const take = Math.min(item.quantity, qty);
  await updateItem(itemId, { quantity: item.quantity - take });
  await addMovement({ itemId, type: "issue", quantity: take, rate: item.rate, reference, note });
}

// ───── Aggregates (unchanged) ─────────────────────────────────────────────
export const itemValuation = (i: InventoryItem) => i.quantity * i.rate;
export const totalValuation = () => getItems().reduce((s, i) => s + itemValuation(i), 0);
export const lowStockCount  = () => getItems().filter((i) => i.active && i.quantity <= i.reorderLevel).length;
