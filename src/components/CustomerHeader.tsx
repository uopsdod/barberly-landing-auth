import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

// Customer-facing navbar (browse + my bookings). Mirrors ShopHeader but for the buyer
// surface; does NOT depend on any "become a shop" control existing.
export function CustomerHeader() {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const navigate = useNavigate();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else navigate("/");
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-5 sm:px-8">
        <Link to="/" className="font-serif text-2xl font-semibold">Barberly</Link>
        <nav className="ml-2 flex items-center gap-4">
          <NavLink to="/barbers" className={linkCls}>Barbers</NavLink>
          {user && <NavLink to="/bookings" className={linkCls}>My bookings</NavLink>}
          {isAdmin && <NavLink to="/admin/payouts" className={linkCls}>Payouts</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Hi <span className="text-foreground">{user.email}</span>
              </span>
              <button
                onClick={signOut}
                className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/sign-in"
              className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
