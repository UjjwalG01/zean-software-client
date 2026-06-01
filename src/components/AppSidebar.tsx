import {
  LayoutDashboard, Users, CalendarDays, Receipt, BarChart3, Settings, Dumbbell, Crown,
  UserCheck, TrendingUp, Wrench, UserCog, Mail, Building2, Tag, Package, Warehouse, Layers, ScrollText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useMyPermissions, canView } from "@/hooks/use-permissions";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, key: "dashboard" },
  { title: "Members", url: "/members", icon: Users, key: "members" },
  { title: "Bookings", url: "/bookings", icon: CalendarDays, key: "bookings" },
  { title: "Attendance", url: "/attendance", icon: UserCheck, key: "attendance" },
  { title: "Transactions", url: "/transactions", icon: Receipt, key: "transactions" },
  { title: "Inventory", url: "/inventory", icon: Package, key: "inventory" },
  { title: "Reports", url: "/reports", icon: BarChart3, key: "reports" },
  { title: "Forecast", url: "/forecast", icon: TrendingUp, key: "forecast" },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText, key: "audit-logs" },
];

const setupItems = [
  { title: "General Setup", url: "/setup/general", icon: Wrench, key: "general" },
  { title: "Outlets", url: "/setup/outlets", icon: Building2, key: "outlets" },
  { title: "Service Types", url: "/setup/service-types", icon: Tag, key: "service-types" },
  { title: "Plans & Services", url: "/setup/plans", icon: Dumbbell, key: "plans" },
  { title: "Stores", url: "/setup/stores", icon: Warehouse, key: "stores" },
  { title: "Item Groups", url: "/setup/item-groups", icon: Layers, key: "item-groups" },
  { title: "Charge Heads", url: "/setup/charge-heads", icon: Tag, key: "charge-heads" },
  { title: "Users & Roles", url: "/setup/users", icon: UserCog, key: "users" },
  { title: "Email Templates", url: "/setup/email-templates", icon: Mail, key: "email-templates" },
  { title: "Settings", url: "/setup/settings", icon: Settings, key: "settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { data: myPerms } = useMyPermissions();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const visibleMain = mainItems.filter((i) => canView(myPerms, i.key));
  const visibleSetup = setupItems.filter((i) => canView(myPerms, i.key));

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
              {visibleMain.map((item) => (
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
              {visibleSetup.map((item) => (
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
