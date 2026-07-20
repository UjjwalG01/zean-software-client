import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMemberAvatar } from "@/lib/member-avatar";
import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  /** Value from `members.avatar_url` — a storage path OR an absolute URL. */
  src?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  onImageClick?: (resolvedUrl: string) => void;
}

/**
 * Renders a member avatar backed by a signed URL from the PRIVATE `members`
 * bucket. Falls back to initials while loading or on failure.
 */
export function MemberAvatar({
  src,
  name,
  className,
  fallbackClassName,
  onImageClick,
}: MemberAvatarProps) {
  const { data: signedUrl = "" } = useMemberAvatar(src ?? "");
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Avatar
      className={cn(className)}
      onClick={
        signedUrl && onImageClick
          ? (e) => {
              e.stopPropagation();
              onImageClick(signedUrl);
            }
          : undefined
      }
    >
      {signedUrl ? <AvatarImage src={signedUrl} alt={name} /> : null}
      <AvatarFallback className={cn("text-xs", fallbackClassName)}>
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
