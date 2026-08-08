import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ForcePasswordChangeModal } from "@/components/ForcePasswordChangeModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import MembersList from "./pages/MembersList";
import MemberProfile from "./pages/MemberProfile";
import MemberGRC from "./pages/MemberGRC";
import AddMember from "./pages/AddMember";
import Bookings from "./pages/Bookings";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import PlansServices from "./pages/PlansServices";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Attendance from "./pages/Attendance";
import Forecast from "./pages/Forecast";
import GeneralSetup from "./pages/GeneralSetup";
import Users from "./pages/Users";
import EmailTemplates from "./pages/EmailTemplates";
import OutletsPage from "./pages/setup/Outlets";
import ServiceTypesPage from "./pages/setup/ServiceTypes";
import Inventory from "./pages/Inventory";
import Help from "./pages/Help";
import StoresPage from "./pages/setup/Stores";
import SuppliersPage from "./pages/setup/Suppliers";
import InventoryMovementsPage from "./pages/InventoryMovements";
import InventoryAnalyticsPage from "./pages/InventoryAnalytics";
import ItemGroupsPage from "./pages/setup/ItemGroups";
import ChargeHeadsPage from "./pages/setup/ChargeHeads";
import AuditLogs from "./pages/AuditLogs";
import { OutletProvider } from "./contexts/OutletContext";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { pingSupabase } from "@/lib/supabase";
import { setAppTimezone } from "@/lib/tz";
import { setActiveVatRate } from "@/lib/vat";
import { useCompanySettings } from "@/hooks/use-firestore";
import { TitleSync } from "./components/TitleSync";
import { useLicense } from "@/hooks/use-license";

const queryClient = new QueryClient();

function SupabaseProbe() {
  useEffect(() => {
    pingSupabase().then((r) => {
      // eslint-disable-next-line no-console
      console.log(
        `[supabase] ${r.ok ? "✓ connected" : "✗ failed"}`,
        r.error || "",
      );
    });
  }, []);
  return null;
}

/** Pushes the configured timezone + VAT rate into the global helpers. */
function TimezoneSync() {
  const { data: settings } = useCompanySettings();
  useEffect(() => {
    setAppTimezone((settings as any)?.timezone || null);
    const raw = (settings as any)?.vatRate ?? (settings as any)?.vat_rate;
    if (raw !== undefined && raw !== null && raw !== "") setActiveVatRate(raw);
  }, [settings]);
  return null;
}


function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, appUser } = useAuthContext();
  const { state: license, loading: licenseLoading } = useLicense();

  if (loading || licenseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-dark">
        <div className="text-center space-y-4">
          <Skeleton className="h-16 w-16 rounded-2xl mx-auto" />
          <Skeleton className="h-6 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A lapsed / missing / suspended license locks the app down to the login
  // page, where the renewal form lives.
  if (license && license.status !== "active") {
    return <Navigate to={`/login?license=${license.status}`} replace />;
  }

  // Block deactivated users from reaching any protected page.
  if (appUser && appUser.isActive === false) {
    // Best-effort sign-out so the session token is dropped immediately.
    import("@/lib/auth-service").then((m) => m.signOut()).catch(() => {});
    return <Navigate to="/login?deactivated=1" replace />;
  }

  return (
    <>
      <ForcePasswordChangeModal />
      {children}
    </>
  );
}


const App = () => (
  <ThemeProvider
    defaultTheme="dark"
    attribute="class"
    storageKey="vitafit-theme"
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SupabaseProbe />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <TitleSync />
          <ErrorBoundary>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <AuthGuard>
                    <OutletProvider>
                      <TimezoneSync />
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/members" element={<MembersList />} />
                          <Route path="/members/new" element={<AddMember />} />
                          <Route
                            path="/members/:id"
                            element={<MemberProfile />}
                          />
                          <Route
                            path="/members/:id/grc"
                            element={<MemberGRC />}
                          />
                          <Route path="/bookings" element={<Bookings />} />
                          <Route path="/attendance" element={<Attendance />} />
                          <Route path="/forecast" element={<Forecast />} />
                          <Route
                            path="/transactions"
                            element={<Transactions />}
                          />
                          <Route path="/reports" element={<Reports />} />
                          <Route
                            path="/setup/general"
                            element={<GeneralSetup />}
                          />
                          <Route
                            path="/setup/plans"
                            element={<PlansServices />}
                          />
                          <Route path="/setup/users" element={<Users />} />
                          <Route
                            path="/setup/email-templates"
                            element={<EmailTemplates />}
                          />
                          <Route
                            path="/setup/outlets"
                            element={<OutletsPage />}
                          />
                          <Route
                            path="/setup/service-types"
                            element={<ServiceTypesPage />}
                          />
                          <Route
                            path="/setup/settings"
                            element={<Settings />}
                          />
                          <Route path="/setup/help" element={<Help />} />
                          <Route path="/inventory" element={<Inventory />} />
                          <Route
                            path="/inventory/movements"
                            element={<InventoryMovementsPage />}
                          />
                          <Route
                            path="/inventory/analytics"
                            element={<InventoryAnalyticsPage />}
                          />
                          <Route
                            path="/setup/suppliers"
                            element={<SuppliersPage />}
                          />
                          <Route
                            path="/setup/stores"
                            element={<StoresPage />}
                          />
                          <Route
                            path="/setup/item-groups"
                            element={<ItemGroupsPage />}
                          />
                          <Route
                            path="/setup/charge-heads"
                            element={<ChargeHeadsPage />}
                          />
                          <Route path="/audit-logs" element={<AuditLogs />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </OutletProvider>
                  </AuthGuard>
                }
              />
            </Routes>
          </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
