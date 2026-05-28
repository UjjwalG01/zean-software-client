import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as users from "@/lib/firebase-users";
import { createFirebaseAuthUser } from "@/lib/firebase-auth";

export function useAppUsers() {
  return useQuery({
    queryKey: ["appUsers"],
    queryFn: () => users.getAppUsers(),
  });
}

export function useCreateAppUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      username: string; email: string; password: string;
      fullName: string; phone?: string; address?: string;
      role: users.UserRole;
      customRoleId?: string;
    }) => {
      const uid = await createFirebaseAuthUser(input.email, input.password);
      const id = await users.createAppUserRecord({
        uid,
        username: input.username,
        email: input.email,
        fullName: input.fullName,
        phone: input.phone || "",
        address: input.address || "",
        role: input.role,
        customRoleId: input.customRoleId || "",
        isActive: true,
        mustChangePassword: true,
      });
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appUsers"] }),
  });
}

export function useUpdateAppUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<users.AppUser> }) =>
      users.updateAppUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appUsers"] }),
  });
}

export function useDeleteAppUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => users.deleteAppUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appUsers"] }),
  });
}
