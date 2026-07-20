## Phase 1 — Member Profile Schema & Data Sync

Align the member read/write path with `db/schema.sql` (JSONB `address`, `emergency_contact`, `physical`, `medical`), add Zod validation, and switch avatar rendering to signed URLs (the `members` bucket is now private per the latest security migration).

### Current state (audit)

- `src/lib/supabase-services.ts` — `mapMemberRow` / `memberPayload` already read & write the JSONB shapes correctly (permanent/temporary, name/phone/address, chest/height/weight/blood_group, heart_stroke/skin_disease/breathing_difficulty). Good baseline.
- `src/pages/MemberProfile.tsx` — the edit dialog only exposes a single flat `address` and `emergencyContact` string; physical/medical are not editable here. Reads `member.avatar` as a public URL.
- `src/pages/AddMember.tsx` — writes flat `permanentAddress`, `temporaryAddress`, `emergencyName`, `emergencyContactNum`, `bloodGroup`, etc. (mapped OK), but has no schema validation; uploads via `getPublicUrl` (broken with private bucket).
- `src/pages/MembersList.tsx` — renders avatars via `AvatarImage src={m.avatar}` (public URL); breaks now.
- No Zod schema exists for members.

### Changes

1. **New: `src/lib/schemas/member.ts`**
   - Zod schemas for the four JSONB blocks + top-level member fields.
   - Export `MemberFormSchema` (full form) and `MemberQuickEditSchema` (name/email/phone/permanent+temporary address/emergency).
   - Types inferred with `z.infer` — reused by AddMember and MemberProfile.

2. **New: `src/lib/member-avatar.ts`**
   - `getMemberAvatarSignedUrl(path, expiresIn=3600)` — resolves the `avatar_url` DB value (which stores the storage path or full public URL) into a signed URL. Falls back to the dicebear placeholder when empty.
   - `useMemberAvatar(pathOrUrl)` — a small `useQuery` wrapper keyed by path with a 55-minute stale time.
   - `uploadMemberAvatar(file, memberId)` — replaces `uploadMemberAvatar` in `supabase-services.ts`: uploads to `members/{memberId}/{ts}.{ext}` and returns the **storage path** (not public URL), so the DB stores a stable key that can be re-signed later.

3. **`src/lib/supabase-services.ts`**
   - `uploadMemberAvatar` returns the storage path only (breaking `getPublicUrl` dependency); update callers accordingly.
   - `mapMemberRow` unchanged (already schema-aligned) — but `avatar` field is annotated to hold either a storage path or an external URL; consumers must resolve via `getMemberAvatarSignedUrl`.

4. **`src/pages/AddMember.tsx`**
   - Wrap the form with `react-hook-form` **only where cheap** — actually, keep the existing controlled inputs but validate the full payload with `MemberFormSchema.safeParse` on submit; surface field errors via toast.
   - Photo upload: after `uploadMemberAvatar` returns the path, store it via `updateMember({ avatar: path })`; preview uses the signed URL hook.

5. **`src/pages/MemberProfile.tsx`**
   - Replace the flat `editForm` with the JSONB-shaped structure: permanent + temporary address, emergency `{name, phone, address}`, and add a Physical (chest/height/weight/blood_group) + Medical (heart_stroke/skin_disease/breathing_difficulty) block.
   - Validate on save with `MemberQuickEditSchema` (extended for the new fields).
   - Replace `<AvatarImage src={member.avatar}>` with a signed-URL resolver.

6. **`src/pages/MembersList.tsx`**
   - Replace direct `m.avatar` binding with the signed-URL hook / helper. Fallback to initials while loading.

7. **Verification**
   - `bun run build`
   - `bunx vitest run` (existing member/booking suites)
   - Manual grep: no remaining `getPublicUrl('members'...` or `storage.from('members').getPublicUrl` calls.

### Out of scope (later phases)

Attendance tables, expiry calc rework, admin password reset flows, ledger inconsistencies, dedup of `use-firestore.ts` / `use-charges.ts` / `supabase-services.ts`, and plan-usage analytics — reserved for Phases 2-6.
