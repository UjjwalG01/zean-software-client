// src/components/MobileAppConnectModal.tsx
import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Smartphone, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCompanySettings } from "@/hooks/use-firestore";

interface MobileAppConnectModalProps {
  propertyName?: string;
  outletId?: string;
}

export const MobileAppConnectModal: React.FC<MobileAppConnectModalProps> = ({
  propertyName = "Zean Software",
  outletId,
}) => {
  const { data: settings = {} } = useCompanySettings();
  // Construct payload matching the React Native mobile app's expected format
  const qrPayload = JSON.stringify({
    version: 1,
    propertyName: settings.companyName || propertyName,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
    supabasePublishableKey:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      "",
    outletId: outletId || null,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-primary/30 hover:border-primary"
        >
          <QrCode className="h-4 w-4 text-primary" />
          <span>Show App QR</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="p-3 bg-primary/10 rounded-full mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Pair Mobile App
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Scan this QR code from the setup screen on the mobile app to pair
            with this property instance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl my-2 border shadow-inner">
          <QRCodeSVG
            value={qrPayload}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg text-left">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span>
            This QR code contains your public Supabase endpoint configuration.
            It does not expose administrative secret keys.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
