import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { LicensedFooter } from "@/components/LicensedFooter";
import { RouteGuard } from "@/components/RouteGuard";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <RouteGuard>{children}</RouteGuard>
          </main>
          <footer className="border-t border-border/50 bg-background/60 backdrop-blur px-4 lg:px-6 py-2 flex items-center justify-end">
            <LicensedFooter />
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
