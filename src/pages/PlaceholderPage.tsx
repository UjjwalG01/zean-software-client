import { Construction } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Construction className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold font-display">{title}</h1>
      <p className="text-muted-foreground mt-2 max-w-md">This module is coming soon. It will be available in a future update.</p>
    </div>
  );
}
