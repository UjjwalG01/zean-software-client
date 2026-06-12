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
