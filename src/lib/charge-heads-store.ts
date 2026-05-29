// Local-storage backed Charge Heads store (admin-managed list of misc charges).
// Mirrors the inventory-store pattern: a sync CRUD over an in-memory cache.

const KEY = "vfc_charge_heads_v1";

export interface ChargeHead {
  id: string;
  name: string;
  defaultAmount?: number;
  active: boolean;
  createdAt: string;
}

const DEFAULTS: Omit<ChargeHead, "id" | "createdAt">[] = [
  { name: "Equipment Damage", defaultAmount: 0, active: true },
  { name: "License Renewal", defaultAmount: 1500, active: true },
  { name: "Breakage Fee", defaultAmount: 0, active: true },
  { name: "Locker Replacement", defaultAmount: 500, active: true },
  { name: "Miscellaneous", defaultAmount: 0, active: true },
];

function read(): ChargeHead[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seeded = DEFAULTS.map((d, i) => ({
        ...d,
        id: `ch-${Date.now()}-${i}`,
        createdAt: new Date().toISOString(),
      }));
      localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function write(rows: ChargeHead[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("charge-heads-changed"));
}

export const chargeHeadsStore = {
  list(): ChargeHead[] {
    return read().sort((a, b) => a.name.localeCompare(b.name));
  },
  active(): ChargeHead[] {
    return this.list().filter((c) => c.active);
  },
  add(input: Omit<ChargeHead, "id" | "createdAt">): ChargeHead {
    const row: ChargeHead = {
      ...input,
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    write([row, ...read()]);
    return row;
  },
  update(id: string, patch: Partial<ChargeHead>) {
    write(read().map((r) => (r.id === id ? { ...r, ...patch } : r)));
  },
  remove(id: string) {
    write(read().filter((r) => r.id !== id));
  },
};
