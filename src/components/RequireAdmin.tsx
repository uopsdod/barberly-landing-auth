import { Navigate, Outlet } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";

// Gates the admin surfaces (/admin/*) on profiles.role === 'admin'.
// RequireAuth guarantees a signed-in user upstream; this adds the role check.
// UX only — real enforcement is Supabase RLS + the admin-guarded RPCs.
export function RequireAdmin() {
  const { isAdmin, loading } = useProfile();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
