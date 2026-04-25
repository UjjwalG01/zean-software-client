import {
  LayoutDashboard, Users, CalendarDays, Receipt, BarChart3, Settings, Dumbbell, Crown,
  UserCheck, TrendingUp, Wrench, UserCog, Mail,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Bookings", url: "/bookings", icon: CalendarDays },
  { title: "Attendance", url: "/attendance", icon: UserCheck },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Forecast", url: "/forecast", icon: TrendingUp },
];

const setupItems = [
  { title: "General Setup", url: "/setup/general", icon: Wrench },
  { title: "Plans & Services", url: "/setup/plans", icon: Dumbbell },
  { title: "Users & Roles", url: "/setup/users", icon: UserCog },
  { title: "Email Templates", url: "/setup/email-templates", icon: Mail },
  { title: "Settings", url: "/setup/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-gold">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold font-display text-gradient-gold">VitaFit</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Club</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {setupItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Version 1.0.0</p>
            <p className="text-[10px] text-muted-foreground/60">© 2026 VitaFit Club</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
