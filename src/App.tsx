import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import MembersList from "./pages/MembersList";
import MemberProfile from "./pages/MemberProfile";
import AddMember from "./pages/AddMember";
import Bookings from "./pages/Bookings";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="dark" attribute="class" storageKey="vitafit-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/members" element={<MembersList />} />
              <Route path="/members/new" element={<AddMember />} />
              <Route path="/members/:id" element={<MemberProfile />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/transactions" element={<PlaceholderPage title="Transactions" />} />
              <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
              <Route path="/setup/plans" element={<PlaceholderPage title="Plans & Services" />} />
              <Route path="/setup/settings" element={<PlaceholderPage title="Settings" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
