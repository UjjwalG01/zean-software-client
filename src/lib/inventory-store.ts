// Local inventory store backed by localStorage. Matches the project's offline-first
// fallback pattern. Easy to swap for Firestore/Supabase later via the same API.

export type InventoryStore = { id: string; name: string; location?: string; active: boolean };
export type ItemGroup = { id: string; name: string; description?: string; active: boolean };
export type MovementType = "opening" | "purchase" | "issue" | "adjustment";

export type InventoryItem = {
  id: string;
  code: string;
  name: string;
  groupId: string;
  storeId: string;
  unit: string; // pcs, kg, ltr...
  quantity: number;
  rate: number; // weighted-average, VAT-inclusive
  reorderLevel: number;
  active: boolean;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number; // positive number; type indicates direction
  rate: number;
  reference?: string;
  note?: string;
  createdBy?: string;
  createdAt: string;
};

const K = {
  stores: "inv:stores",
  groups: "inv:groups",
  items: "inv:items",
  movements: "inv:movements",
  seeded: "inv:seeded:v1",
};

const read = <T>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
};
const write = <T>(k: string, v: T) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

/* ---------- Seed ---------- */
export function seedInventoryIfEmpty() {
  if (localStorage.getItem(K.seeded)) return;
  const stores: InventoryStore[] = [
    { id: "st-main", name: "Main Store", location: "Ground Floor", active: true },
    { id: "st-spa", name: "Spa Store", location: "First Floor", active: true },
    { id: "st-cafe", name: "Cafe & F&B", location: "Lobby", active: true },
  ];
  const groups: ItemGroup[] = [
    { id: "gp-supp", name: "Supplements", active: true },
    { id: "gp-spa", name: "Spa Products", active: true },
    { id: "gp-bev", name: "Beverages", active: true },
    { id: "gp-eq", name: "Gym Equipment", active: true },
  ];
  const items: InventoryItem[] = [
    { id: uid(), code: "SUP-001", name: "Whey Protein 2kg", groupId: "gp-supp", storeId: "st-main", unit: "pcs", quantity: 24, rate: 6500, reorderLevel: 5, active: true, createdAt: now() },
    { id: uid(), code: "SUP-002", name: "Creatine 500g",   groupId: "gp-supp", storeId: "st-main", unit: "pcs", quantity: 12, rate: 2800, reorderLevel: 4, active: true, createdAt: now() },
    { id: uid(), code: "SPA-001", name: "Massage Oil 1L",  groupId: "gp-spa",  storeId: "st-spa",  unit: "ltr", quantity: 8,  rate: 1800, reorderLevel: 3, active: true, createdAt: now() },
    { id: uid(), code: "SPA-002", name: "Aromatic Candle", groupId: "gp-spa",  storeId: "st-spa",  unit: "pcs", quantity: 30, rate: 450,  reorderLevel: 10, active: true, createdAt: now() },
    { id: uid(), code: "BEV-001", name: "Mineral Water 1L",groupId: "gp-bev",  storeId: "st-cafe", unit: "pcs", quantity: 120,rate: 60,   reorderLevel: 50, active: true, createdAt: now() },
    { id: uid(), code: "BEV-002", name: "Energy Drink",    groupId: "gp-bev",  storeId: "st-cafe", unit: "pcs", quantity: 3,  rate: 220,  reorderLevel: 12, active: true, createdAt: now() },
    { id: uid(), code: "EQ-001",  name: "Resistance Band", groupId: "gp-eq",   storeId: "st-main", unit: "pcs", quantity: 0,  rate: 850,  reorderLevel: 5, active: true, createdAt: now() },
  ];
  const movements: StockMovement[] = items.map((it) => ({
    id: uid(), itemId: it.id, type: "opening", quantity: it.quantity, rate: it.rate, note: "Opening balance", createdAt: now(),
  }));
  write(K.stores, stores); write(K.groups, groups); write(K.items, items); write(K.movements, movements);
  localStorage.setItem(K.seeded, "1");
}

/* ---------- Stores ---------- */
export const getStores = (): InventoryStore[] => read(K.stores, []);
export const saveStore = (s: Omit<InventoryStore, "id"> & { id?: string }): InventoryStore => {
  const list = getStores();
  if (s.id) {
    const i = list.findIndex((x) => x.id === s.id);
    if (i >= 0) list[i] = { ...list[i], ...s } as InventoryStore;
  } else {
    list.push({ ...s, id: uid() });
  }
  write(K.stores, list);
  return list[list.length - 1];
};
export const deleteStore = (id: string) => write(K.stores, getStores().filter((s) => s.id !== id));

/* ---------- Groups ---------- */
export const getGroups = (): ItemGroup[] => read(K.groups, []);
export const saveGroup = (g: Omit<ItemGroup, "id"> & { id?: string }): ItemGroup => {
  const list = getGroups();
  if (g.id) {
    const i = list.findIndex((x) => x.id === g.id);
    if (i >= 0) list[i] = { ...list[i], ...g } as ItemGroup;
  } else {
    list.push({ ...g, id: uid() });
  }
  write(K.groups, list);
  return list[list.length - 1];
};
export const deleteGroup = (id: string) => write(K.groups, getGroups().filter((g) => g.id !== id));

/* ---------- Items ---------- */
export const getItems = (): InventoryItem[] => read(K.items, []);
export const getItem = (id: string): InventoryItem | undefined => getItems().find((i) => i.id === id);

export const createItem = (payload: Omit<InventoryItem, "id" | "createdAt">): InventoryItem => {
  const list = getItems();
  const item: InventoryItem = { ...payload, id: uid(), createdAt: now() };
  list.push(item);
  write(K.items, list);
  if (item.quantity > 0) {
    addMovement({ itemId: item.id, type: "opening", quantity: item.quantity, rate: item.rate, note: "Opening balance" });
  }
  return item;
};

export const updateItem = (id: string, patch: Partial<InventoryItem>) => {
  const list = getItems();
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) { list[i] = { ...list[i], ...patch }; write(K.items, list); }
};
export const deleteItem = (id: string) => {
  write(K.items, getItems().filter((i) => i.id !== id));
  write(K.movements, getMovements().filter((m) => m.itemId !== id));
};

/* ---------- Movements ---------- */
export const getMovements = (): StockMovement[] => read(K.movements, []);
export const getMovementsByItem = (itemId: string): StockMovement[] =>
  getMovements().filter((m) => m.itemId === itemId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const addMovement = (m: Omit<StockMovement, "id" | "createdAt">): StockMovement => {
  const list = getMovements();
  const mv: StockMovement = { ...m, id: uid(), createdAt: now() };
  list.push(mv);
  write(K.movements, list);
  return mv;
};

/** Purchase: increase qty, weighted-average rate. */
export const purchaseStock = (itemId: string, qty: number, rate: number, reference?: string, note?: string) => {
  const item = getItem(itemId);
  if (!item || qty <= 0) return;
  const newQty = item.quantity + qty;
  const newRate = newQty > 0
    ? Math.round((((item.quantity * item.rate) + (qty * rate)) / newQty) * 100) / 100
    : rate;
  updateItem(itemId, { quantity: newQty, rate: newRate });
  addMovement({ itemId, type: "purchase", quantity: qty, rate, reference, note });
};

/** Issue: decrease qty (cannot go below 0). */
export const issueStock = (itemId: string, qty: number, reference?: string, note?: string) => {
  const item = getItem(itemId);
  if (!item || qty <= 0) return;
  const take = Math.min(item.quantity, qty);
  updateItem(itemId, { quantity: item.quantity - take });
  addMovement({ itemId, type: "issue", quantity: take, rate: item.rate, reference, note });
};

/* ---------- Aggregates ---------- */
export const itemValuation = (i: InventoryItem) => i.quantity * i.rate;
export const totalValuation = () => getItems().reduce((s, i) => s + itemValuation(i), 0);
export const lowStockCount = () => getItems().filter((i) => i.active && i.quantity <= i.reorderLevel).length;
