import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  BarChart3,
  Settings,
  Dumbbell,
  Crown,
  UserCheck,
  TrendingUp,
  Wrench,
  UserCog,
  Mail,
  Building2,
  Tag,
  Package,
  Warehouse,
  Layers,
  ScrollText,
  Truck,
  HelpCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useMyPermissions, canView } from "@/hooks/use-permissions";

export const softwareName = "ZEAN";
export const softwareVersion = "2.0.1";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, key: "dashboard" },
  { title: "Members", url: "/members", icon: Users, key: "members" },
  { title: "Bookings", url: "/bookings", icon: CalendarDays, key: "bookings" },
  {
    title: "Attendance",
    url: "/attendance",
    icon: UserCheck,
    key: "attendance",
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: Receipt,
    key: "transactions",
  },
  { title: "Inventory", url: "/inventory", icon: Package, key: "inventory" },
  { title: "Reports", url: "/reports", icon: BarChart3, key: "reports" },
  { title: "Forecast", url: "/forecast", icon: TrendingUp, key: "forecast" },
  {
    title: "Audit Logs",
    url: "/audit-logs",
    icon: ScrollText,
    key: "audit-logs",
  },
];

const setupItems = [
  {
    title: "Plans & Services",
    url: "/setup/plans",
    icon: Dumbbell,
    key: "plans",
  },
  {
    title: "Suppliers",
    url: "/setup/suppliers",
    icon: Truck,
    key: "suppliers",
  },
  {
    title: "Item Groups",
    url: "/setup/item-groups",
    icon: Layers,
    key: "item-groups",
  },
  {
    title: "Charge Heads",
    url: "/setup/charge-heads",
    icon: Tag,
    key: "charge-heads",
  },
  {
    title: "Email Templates",
    url: "/setup/email-templates",
    icon: Mail,
    key: "email-templates",
  },
];

const adminItems = [
  {
    title: "General Setup",
    url: "/setup/general",
    icon: Wrench,
    key: "general",
  },
  { title: "Outlets", url: "/setup/outlets", icon: Building2, key: "outlets" },
  {
    title: "Service Types",
    url: "/setup/service-types",
    icon: Tag,
    key: "service-types",
  },
  { title: "Stores", url: "/setup/stores", icon: Warehouse, key: "stores" },
  { title: "Users & Roles", url: "/setup/users", icon: UserCog, key: "users" },
  {
    title: "Settings",
    url: "/setup/settings",
    icon: Settings,
    key: "settings",
  },
  { title: "Help", url: "/setup/help", icon: HelpCircle, key: "help" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const { data: myPerms, isLoading: isPermsLoading } = useMyPermissions();

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const visibleMain = mainItems.filter((i) =>
    canView(myPerms, i.key, isPermsLoading),
  );
  const visibleSetup = setupItems.filter((i) =>
    canView(myPerms, i.key, isPermsLoading),
  );
  const visibleAdmin = adminItems.filter(
    (i) => i.key === "help" || canView(myPerms, i.key, isPermsLoading),
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-t gradient-gold">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-extrabold font-display text-gradient-gold">
                {softwareName}
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Software
              </p>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
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
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Setup
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSetup.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
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
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleAdmin.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
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
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
            <LicenseStatusBadge />
            <p className="text-xs text-muted-foreground">
              Version {softwareVersion}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              © {new Date().getFullYear()} {softwareName} Software
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
