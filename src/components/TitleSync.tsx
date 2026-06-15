import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function TitleSync() {
  const location = useLocation();

  useEffect(() => {
    // 1. Define a mapping of your application paths to clean title strings
    const titleMap: Record<string, string> = {
      "/": "Dashboard",
      "/members": "Members List",
      "/members/new": "Add Member",
      "/bookings": "Bookings",
      "/attendance": "Attendance Tracking",
      "/forecast": "Business Forecast",
      "/transactions": "Transactions & Ledger",
      "/reports": "Analytical Reports",
      "/inventory": "Inventory Management",
      "/audit-logs": "System Audit Logs",
      "/setup/general": "General Configuration",
      "/setup/plans": "Plans & Services Setup",
      "/setup/users": "Users & Roles Management",
      "/setup/email-templates": "Email Templates",
      "/setup/outlets": "Outlets Setup",
      "/setup/service-types": "Service Types",
      "/setup/stores": "Stores Management",
      "/setup/item-groups": "Item Groups",
      "/setup/charge-heads": "Charge Heads",
      "/setup/settings": "System Settings",
      "/login": "Login",
    };

    const currentPath = location.pathname;

    // 2. Handle dynamic parameters (like /members/:id) fallback gracefully
    let pageTitle = titleMap[currentPath];

    if (!pageTitle) {
      if (currentPath.startsWith("/members/") && currentPath.endsWith("/grc")) {
        pageTitle = "Member GRC";
      } else if (currentPath.startsWith("/members/")) {
        pageTitle = "Member Profile";
      } else {
        pageTitle = "Page Not Found";
      }
    }

    // 3. Update the native browser document object model
    document.title = `${pageTitle} | Zean Software`;
  }, [location]);

  return null;
}
