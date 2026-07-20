import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * The `members` storage bucket is PRIVATE (see db/migrations/2026-07-18_…sql).
 * `members.avatar_url` may contain either:
 *   - a storage object path (e.g. `"<memberId>/photo-1721234.jpg"`), or
 *   - a legacy absolute URL (pre-hardening rows or dicebear placeholders).
 *
 * Consumers must resolve display URLs through `getMemberAvatarSignedUrl` or
 * the `useMemberAvatar` hook — never bind `avatar_url` directly to `<img>`
 * when the source is a private storage key.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const STALE_TIME_MS = 55 * 60 * 1000; // refresh a few minutes before expiry

/** Whether the stored value should be treated as a bucket path (not a URL). */
function isStoragePath(value: string): boolean {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  return true;
}

/**
 * Resolve a `members.avatar_url` value to a displayable URL.
 * Absolute URLs (including dicebear fallbacks) pass through unchanged.
 * Storage paths are signed against the private `members` bucket.
 * Returns an empty string on failure so callers can fall back to initials.
 */
export async function getMemberAvatarSignedUrl(
  value: string | null | undefined,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (!isStoragePath(raw)) return raw;
  const { data, error } = await supabase.storage
    .from("members")
    .createSignedUrl(raw, expiresIn);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

/**
 * React Query hook that returns a signed URL for a member avatar.
 * Cached per storage path; absolute URLs short-circuit without a network call.
 */
export function useMemberAvatar(value: string | null | undefined) {
  const key = (value || "").trim();
  return useQuery({
    queryKey: ["member-avatar", key],
    queryFn: () => getMemberAvatarSignedUrl(key),
    enabled: !!key,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Upload a member avatar and return the STORAGE PATH (not a public URL).
 * The path is what should be persisted to `members.avatar_url`.
 */
export async function uploadMemberAvatarPath(
  memberId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${memberId}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("members").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}
