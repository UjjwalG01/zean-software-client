import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  loadInventory, seedInventoryIfEmpty,
  getStores, saveStore, deleteStore,
  getGroups, saveGroup, deleteGroup,
  getSuppliers, saveSupplier, deleteSupplier,
  getItems, getMovementsByItem, listAllMovements,
  createItem, editItem, deleteItem,
  purchaseStock, issueStock, adjustStock, transferStock,
  type InventoryItem, type InventoryStore, type ItemGroup, type InventorySupplier,
} from "@/lib/inventory-store";

const KEYS = {
  stores: ["inv", "stores"] as const,
  groups: ["inv", "groups"] as const,
  suppliers: ["inv", "suppliers"] as const,
  items: ["inv", "items"] as const,
  movements: (id: string) => ["inv", "movements", id] as const,
  allMovements: ["inv", "movements", "all"] as const,
};

async function ensureLoaded() {
  seedInventoryIfEmpty();
  await loadInventory();
}

export function useInventoryStores() {
  return useQuery({ queryKey: KEYS.stores, queryFn: async () => { await ensureLoaded(); return getStores(); } });
}
export function useItemGroups() {
  return useQuery({ queryKey: KEYS.groups, queryFn: async () => { await ensureLoaded(); return getGroups(); } });
}
export function useInventorySuppliers() {
  return useQuery({ queryKey: KEYS.suppliers, queryFn: async () => { await ensureLoaded(); return getSuppliers(); } });
}
export function useInventoryItems() {
  return useQuery({ queryKey: KEYS.items, queryFn: async () => { await ensureLoaded(); return getItems(); } });
}
export function useItemMovements(itemId: string) {
  return useQuery({ queryKey: KEYS.movements(itemId), queryFn: async () => getMovementsByItem(itemId), enabled: !!itemId });
}

/** Full stock-movement ledger (newest first) — the SSOT for inventory reports. */
export function useAllMovements() {
  return useQuery({
    queryKey: KEYS.allMovements,
    queryFn: async () => { await ensureLoaded(); return listAllMovements({ limit: 1000 }); },
  });
}

export function useInventoryMutations() {
  const qc = useQueryClient();
  const invAll = () => { qc.invalidateQueries({ queryKey: ["inv"] }); };
  return {
    saveStore:     useMutation({ mutationFn: (s: Omit<InventoryStore, "id"> & { id?: string }) => saveStore(s), onSuccess: invAll }),
    removeStore:   useMutation({ mutationFn: (id: string) => deleteStore(id), onSuccess: invAll }),
    saveGroup:     useMutation({ mutationFn: (g: Omit<ItemGroup, "id"> & { id?: string }) => saveGroup(g), onSuccess: invAll }),
    removeGroup:   useMutation({ mutationFn: (id: string) => deleteGroup(id), onSuccess: invAll }),
    saveSupplier:  useMutation({ mutationFn: (s: Omit<InventorySupplier, "id"> & { id?: string }) => saveSupplier(s), onSuccess: invAll }),
    removeSupplier:useMutation({ mutationFn: (id: string) => deleteSupplier(id), onSuccess: invAll }),
    createItem:    useMutation({ mutationFn: (i: Omit<InventoryItem, "id" | "createdAt">) => createItem(i), onSuccess: invAll }),
    updateItem:    useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<InventoryItem> }) => editItem(id, patch), onSuccess: invAll }),
    removeItem:    useMutation({ mutationFn: (id: string) => deleteItem(id), onSuccess: invAll }),
    purchase:      useMutation({ mutationFn: (p: { itemId: string; qty: number; rate: number; reference?: string; note?: string; supplierId?: string }) => purchaseStock(p.itemId, p.qty, p.rate, p.reference, p.note, p.supplierId), onSuccess: invAll }),
    issue:         useMutation({ mutationFn: (p: { itemId: string; qty: number; reference?: string; note?: string }) => issueStock(p.itemId, p.qty, p.reference, p.note), onSuccess: invAll }),
    adjust:        useMutation({ mutationFn: (p: { itemId: string; delta: number; reason?: string; reference?: string }) => adjustStock(p.itemId, p.delta, p.reason, p.reference), onSuccess: invAll }),
    transfer:      useMutation({ mutationFn: (p: { itemId: string; toStoreId: string; qty: number; reference?: string; note?: string }) => transferStock(p.itemId, p.toStoreId, p.qty, p.reference, p.note), onSuccess: invAll }),
  };
}
