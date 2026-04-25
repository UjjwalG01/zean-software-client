import { useCompanySettings } from "@/hooks/use-firestore";

interface LicensedFooterProps {
  className?: string;
  /** Use white text variant for dark backgrounds (e.g. login page) */
  variant?: "default" | "muted";
}

export function LicensedFooter({ className = "", variant = "default" }: LicensedFooterProps) {
  const { data: settings = {} } = useCompanySettings();
  const companyName = settings.companyName || "VitaFit Club";

  const colorClass = variant === "muted"
    ? "text-muted-foreground/60"
    : "text-muted-foreground/70";

  return (
    <div className={`text-[11px] font-medium ${colorClass} ${className}`}>
      Licensed to: <span className="text-primary/80 font-semibold">{companyName}</span>
    </div>
  );
}
