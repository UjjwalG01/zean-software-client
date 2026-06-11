import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  listCustomRoles, saveCustomRole, deleteCustomRole, assignRoleToUser,
  getUserPermissions, type CustomRole,
} from "@/lib/firebase-roles";

export function useCustomRoles() {
  return useQuery({ queryKey: ["customRoles"], queryFn: listCustomRoles });
}

export function useSaveCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: Omit<CustomRole, "id"> & { id?: string }) => saveCustomRole(r),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customRoles"] }),
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customRoles"] }),
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId, outletIds }: { userId: string; roleId: string; outletIds?: string[] }) =>
      assignRoleToUser(userId, roleId, outletIds || []),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["myPermissions"] }); qc.invalidateQueries({ queryKey: ["appUsers"] }); },
  });
}

/** Permissions for the currently signed-in user. */
export function useMyPermissions() {
  const { user, appUser } = useAuthContext();
  const isSystemAdmin = appUser?.role === "admin";
  return useQuery({
    queryKey: ["myPermissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return { isAdmin: false, perms: {} as Record<string, any> };
      const p = await getUserPermissions(user.id);
      return { isAdmin: p.isAdmin || isSystemAdmin, perms: p.perms };
    },
    enabled: !!user?.id,
  });
}

export function canView(perms: { isAdmin: boolean; perms: Record<string, { view: boolean }> } | undefined, pageKey: string) {
  if (!perms) return true; // while loading, don't hide
  if (perms.isAdmin) return true;
  // No permissions configured at all → fall back to allow (don't lock users out)
  if (Object.keys(perms.perms).length === 0) return true;
  return !!perms.perms[pageKey]?.view;
}
