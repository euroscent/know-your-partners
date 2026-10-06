import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isStandalone } from "@/lib/pwa";

/**
 * Blocks admin routes when the app is running as an installed PWA.
 * Mitarbeiter-App soll keinen Admin-Bereich anzeigen.
 */
export function MobileAppRouteGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setChecked(true);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!active) return;
      setIsAdmin(roles?.some((r) => r.role === "admin") ?? false);
      setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!checked) return null;

  const isAdminRoute = location.pathname.startsWith("/dashboard/admin");
  if (isAdminRoute && isStandalone() && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
