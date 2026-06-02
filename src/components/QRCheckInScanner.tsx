import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDetected: (memberIdOrCode: string) => void;
}

/**
 * QR check-in scanner. Encodes member id (e.g. "VFC-MBR-0001") in the QR.
 * Uses html5-qrcode (camera). Closes on first successful decode.
 */
// Only stop the scanner when it's actually running/paused — otherwise html5-qrcode throws.
function safeStop(s: Html5Qrcode | null): Promise<void> {
  if (!s) return Promise.resolve();
  try {
    const state = s.getState?.();
    // 2 = SCANNING, 3 = PAUSED in Html5QrcodeScannerState
    if (state === 2 || state === 3) return s.stop().catch(() => {});
  } catch { /* ignore */ }
  return Promise.resolve();
}
export function QRCheckInScanner({ open, onOpenChange, onDetected }: Props) {
  const containerId = "qr-checkin-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    // Wait until the portal-rendered target div is in the DOM
    const waitForEl = (): Promise<HTMLElement> =>
      new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          const el = document.getElementById(containerId);
          if (el) return resolve(el);
          if (Date.now() - started > 3000) return reject(new Error("scanner container not mounted"));
          requestAnimationFrame(tick);
        };
        tick();
      });

    setStarting(true);
    waitForEl()
      .then(() => {
        if (cancelled) return;
        scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        return scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (cancelled) return;
            onDetected(decoded.trim());
            safeStop(scanner).finally(() => onOpenChange(false));
          },
          () => {}
        );
      })
      .then(() => !cancelled && setStarting(false))
      .catch((err) => {
        if (cancelled) return;
        toast.error("Camera unavailable: " + (err?.message || "permission denied"));
        onOpenChange(false);
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      safeStop(s).then(() => { try { s?.clear(); } catch {} });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <QrCode className="h-5 w-5 text-primary" /> Scan Member QR
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div id={containerId} className="rounded-lg overflow-hidden bg-black aspect-square" />
          <p className="text-xs text-muted-foreground text-center">
            {starting ? "Starting camera…" : "Hold the member QR steady inside the frame"}
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
