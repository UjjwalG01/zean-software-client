import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOutlet } from "@/contexts/OutletContext";
import type { Outlet } from "@/lib/supabase-outlets";
import { useQuery } from "@tanstack/react-query";
import { getServiceTypes } from "@/lib/supabase-outlets";

export function OutletPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { outlets, setSelected, isLoading } = useOutlet();
  const navigate = useNavigate();
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: getServiceTypes,
  });

  const handlePick = (o: Outlet) => {
    setSelected(o);
    onOpenChange(false);
  };

  const stMap = Object.fromEntries(serviceTypes.map((s) => [s.slug, s]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Select an Outlet
          </DialogTitle>
          <DialogDescription>
            Choose the outlet you want to manage bookings for.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-semibold">No outlets yet</p>
              <p className="text-sm text-muted-foreground">
                Ask an admin to create your first outlet.
              </p>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate("/setup/outlets");
              }}
              className="gradient-gold text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-1" /> Go to Outlet Setup
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {outlets.map((o) => {
              const accent = o.color || "hsl(38,92%,50%)";
              const img = o.imageUrl || stMap[o.serviceTypes[0]]?.defaultImage;
              return (
                <button
                  key={o.id}
                  onClick={() => handlePick(o)}
                  className="group relative overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/60 transition-all text-left shadow-lg hover:shadow-xl hover:-translate-y-1"
                  style={{ boxShadow: `0 0 0 1px ${accent}22` }}
                >
                  <div className="h-32 w-full overflow-hidden bg-muted relative">
                    {img ? (
                      <img
                        src={img}
                        alt={o.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
                        }}
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(180deg, transparent 40%, ${accent}cc)`,
                      }}
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold font-display text-lg">
                      {o.name}
                    </h3>
                    {o.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {o.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {o.serviceTypes.map((st) => {
                        const sd = stMap[st];
                        return (
                          <Badge
                            key={st}
                            variant="secondary"
                            className="text-[10px]"
                            style={
                              sd?.color
                                ? {
                                    backgroundColor: `${sd.color}22`,
                                    color: sd.color,
                                    borderColor: `${sd.color}44`,
                                  }
                                : undefined
                            }
                          >
                            {sd?.name || st}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
