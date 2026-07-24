import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  listCustomRoles, saveCustomRole, deleteCustomRole, assignRoleToUser,
  getUserPermissions, type CustomRole,
} from "@/lib/supabase-roles";

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
  const { user, appUser, loading: authLoading } = useAuthContext();
  const isSystemAdmin = appUser?.role === "admin";

  return useQuery({
    queryKey: ["myPermissions", user?.id, appUser?.role, appUser?.id],
    queryFn: async () => {
      if (!user?.id) return { isAdmin: false, perms: {} as Record<string, any> };

      // const isSystemAdmin = appUser?.role === "admin";

      try {
        const p = await getUserPermissions(user.id);
        return {
          isAdmin: Boolean(p.isAdmin || isSystemAdmin),
          perms: p.perms ?? {}
        };

      } catch (error) {
        console.error("Error fetching permissions on reload:", error);
        // Throwing error ensures React Query retries automatically rather than caching an empty permission set
        throw error;
      }
    },

    enabled: !!user?.id && !!appUser && !authLoading,
    staleTime: 1000 * 60 * 5, // Cache permissions for 5 minutes
    retry: 3
  });
}

// export function canView(perms: { isAdmin: boolean; perms: Record<string, { view: boolean }> } | undefined, pageKey: string, isLoading?: boolean) {
//   if (isLoading || !perms) return true; // while loading, don't hide
//   if (perms.isAdmin) return true;
//   // Default-deny: users without an explicit `view` grant on this page cannot
//   // access it. Server-side RLS (user_has_action) enforces the same rule.
//   return !!perms.perms[pageKey]?.view;
// }

export function canView(
  perms: { isAdmin: boolean; perms: Record<string, { view: boolean }> } | undefined,
  pageKey: string,
  isLoading?: boolean
) {
  // 1. While auth/permissions are loading, keep items visible to prevent blank menu flashing
  if (isLoading || !perms) return true;

  // 2. Admins always have full access
  if (perms.isAdmin) return true;

  // 3. Fallback check: if perms object is empty (initial state), do not lock out user
  if (!perms.perms || Object.keys(perms.perms).length === 0) return true;

  // 4. Check explicit custom view permission grant
  return !!perms.perms[pageKey]?.view;
}