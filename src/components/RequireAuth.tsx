import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

// Guards any signed-in surface. Sends anonymous users to sign-in.
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}
