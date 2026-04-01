import { Bell, Search, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationPanel } from "@/components/NotificationPanel";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useState } from "react";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

        <button
          onClick={() => {
            // Dispatch Ctrl+K to open search
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
          }}
          className="relative flex-1 max-w-md hidden md:flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
        >
          <Search className="h-4 w-4" />
          <span>Search members, bookings...</span>
          <kbd className="ml-auto text-[10px] bg-background/80 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <NotificationPanel />
          <UserProfileMenu />
        </div>
      </header>
      <GlobalSearch />
    </>
  );
}
