import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import { useAuthContext } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ForcePasswordChangeModal } from "@/components/ForcePasswordChangeModal";
import Index from "./pages/Index";
import MembersList from "./pages/MembersList";
import MemberProfile from "./pages/MemberProfile";
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
import { OutletProvider } from "./contexts/OutletContext";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { pingSupabase } from "@/lib/supabase";

const queryClient = new QueryClient();

function SupabaseProbe() {
  useEffect(() => {
    pingSupabase().then((r) => {
      // eslint-disable-next-line no-console
      console.log(`[supabase] ${r.ok ? "✓ connected" : "✗ failed"}`, r.error || "");
    });
  }, []);
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();

  if (loading) {
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

  return (
    <>
      <ForcePasswordChangeModal />
      {children}
    </>
  );
}

const App = () => (
  <ThemeProvider defaultTheme="dark" attribute="class" storageKey="vitafit-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SupabaseProbe />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <OutletProvider>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/members" element={<MembersList />} />
                      <Route path="/members/new" element={<AddMember />} />
                      <Route path="/members/:id" element={<MemberProfile />} />
                      <Route path="/bookings" element={<Bookings />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/forecast" element={<Forecast />} />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/setup/general" element={<GeneralSetup />} />
                      <Route path="/setup/plans" element={<PlansServices />} />
                      <Route path="/setup/users" element={<Users />} />
                      <Route path="/setup/email-templates" element={<EmailTemplates />} />
                      <Route path="/setup/outlets" element={<OutletsPage />} />
                      <Route path="/setup/service-types" element={<ServiceTypesPage />} />
                      <Route path="/setup/settings" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                  </OutletProvider>
                </AuthGuard>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
