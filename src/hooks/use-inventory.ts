import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  loadInventory, seedInventoryIfEmpty,
  getStores, saveStore, deleteStore,
  getGroups, saveGroup, deleteGroup,
  getItems, getMovementsByItem,
  createItem, updateItem, deleteItem,
  purchaseStock, issueStock,
  type InventoryItem, type InventoryStore, type ItemGroup,
} from "@/lib/inventory-store";

const KEYS = {
  stores: ["inv", "stores"] as const,
  groups: ["inv", "groups"] as const,
  items: ["inv", "items"] as const,
  movements: (id: string) => ["inv", "movements", id] as const,
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
export function useInventoryItems() {
  return useQuery({ queryKey: KEYS.items, queryFn: async () => { await ensureLoaded(); return getItems(); } });
}
export function useItemMovements(itemId: string) {
  return useQuery({ queryKey: KEYS.movements(itemId), queryFn: async () => getMovementsByItem(itemId), enabled: !!itemId });
}

export function useInventoryMutations() {
  const qc = useQueryClient();
  const invAll = () => { qc.invalidateQueries({ queryKey: ["inv"] }); };
  return {
    saveStore:    useMutation({ mutationFn: (s: Omit<InventoryStore, "id"> & { id?: string }) => saveStore(s), onSuccess: invAll }),
    removeStore:  useMutation({ mutationFn: (id: string) => deleteStore(id), onSuccess: invAll }),
    saveGroup:    useMutation({ mutationFn: (g: Omit<ItemGroup, "id"> & { id?: string }) => saveGroup(g), onSuccess: invAll }),
    removeGroup:  useMutation({ mutationFn: (id: string) => deleteGroup(id), onSuccess: invAll }),
    createItem:   useMutation({ mutationFn: (i: Omit<InventoryItem, "id" | "createdAt">) => createItem(i), onSuccess: invAll }),
    updateItem:   useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<InventoryItem> }) => updateItem(id, patch), onSuccess: invAll }),
    removeItem:   useMutation({ mutationFn: (id: string) => deleteItem(id), onSuccess: invAll }),
    purchase:     useMutation({ mutationFn: (p: { itemId: string; qty: number; rate: number; reference?: string; note?: string }) => purchaseStock(p.itemId, p.qty, p.rate, p.reference, p.note), onSuccess: invAll }),
    issue:        useMutation({ mutationFn: (p: { itemId: string; qty: number; reference?: string; note?: string }) => issueStock(p.itemId, p.qty, p.reference, p.note), onSuccess: invAll }),
  };
}
