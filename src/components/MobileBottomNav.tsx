import { NavLink, useLocation } from "react-router-dom";
import { CheckSquare, Mail, Euro, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  matchPaths?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Start", icon: Home },
  { to: "/dashboard/tasks", label: "Aufträge", icon: CheckSquare, matchPaths: ["/dashboard/tasks"] },
  { to: "/dashboard/documents", label: "Postfach", icon: Mail },
  { to: "/dashboard/invoices", label: "Honorar", icon: Euro },
  { to: "/dashboard/employee-settings", label: "Profil", icon: User },
];

export function MobileBottomNav() {
  const location = useLocation();

  const isActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some((p) => location.pathname.startsWith(p));
    }
    return location.pathname === item.to;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
