import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PaymentMethod } from "./mock-data";

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


