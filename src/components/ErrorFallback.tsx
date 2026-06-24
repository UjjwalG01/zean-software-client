import { AlertTriangle, Home, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error;
  onReset: () => void;
}

/**
 * Premium dark fallback UI rendered when a runtime error escapes a route.
 * Provides Go to Dashboard and Reload actions.
 */
export function ErrorFallback({ error, onReset }: Props) {
  const goHome = () => {
    onReset();
    window.location.href = "/";
  };
  const reload = () => window.location.reload();

  return (
    <div className="min-h-screen flex items-center justify-center gradient-dark p-6">
      <div className="glass-card rounded-2xl p-8 max-w-lg w-full space-y-6 border border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl gradient-gold flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-gradient-gold">
              Something went wrong
            </h1>
            <p className="text-xs text-muted-foreground">
              The page crashed but your data is safe.
            </p>
          </div>
        </div>

        <details className="rounded-lg border border-border/40 bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-destructive">
            {error.message}
          </pre>
        </details>

        <div className="flex gap-2">
          <Button onClick={goHome} className="flex-1 gradient-gold text-primary-foreground">
            <Home className="h-4 w-4 mr-1" /> Go to Dashboard
          </Button>
          <Button onClick={reload} variant="outline" className="flex-1">
            <RotateCw className="h-4 w-4 mr-1" /> Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
