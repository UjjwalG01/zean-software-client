import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PaymentMethod, ServiceType } from "./mock-data";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const methodColors: Record<PaymentMethod, string> = {
  cash: "bg-success/20 text-success",
  card: "bg-primary/20 text-primary",
  esewa: "bg-emerald-500/20 text-emerald-400",
  bank_transfer: "bg-muted text-muted-foreground",
  mobile_wallet: "bg-purple-500/20 text-purple-400",
  cheque: "bg-yellow-500/20 text-yellow-400",
  other: "bg-blue-500/20 text-blue-400",
};

export const tooltipStyle = {
  background: "hsl(45, 100%, 97%)", // soft warm ivory
  border: "1px solid hsl(45, 80%, 85%)", // subtle golden border
  borderRadius: 8,
  color: "hsl(220, 25%, 20%)", // deep slate text for contrast
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", // premium soft shadow
  padding: "8px 12px",
};

export const serviceColors: Record<ServiceType, string> = {
  Events: "bg-events/20 text-events",
  Fitness: "bg-fitness/20 text-fitness",
  Health: "bg-health/20 text-health",
  Membership: "bg-membership/20 text-membership",
  Sports: "bg-sports/20 text-sports",
  Wellness: "bg-wellness/20 text-wellness",
};

export const bookingStatusColors: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  cancelled:
    "bg-destructive/15 text-destructive border-destructive/30 line-through",
};


export const colorOptions = [
  { label: "Gold", value: "#FFD700", tw: "bg-events" }, // Events → celebratory gold
  { label: "Blue", value: "#1E90FF", tw: "bg-fitness" }, // Fitness → energetic blue
  { label: "Green", value: "#2ECC71", tw: "bg-health" }, // Health → fresh green
  { label: "Silver", value: "#C0C0C0", tw: "bg-membership" }, // Membership → neutral silver
  { label: "Orange", value: "#FF7F50", tw: "bg-sports" }, // Sports → dynamic orange
  { label: "Purple", value: "#9B59B6", tw: "bg-wellness" }, // Wellness → calming purple
];

