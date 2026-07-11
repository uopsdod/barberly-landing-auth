import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function ShopHeader() {
  const { user } = useAuth();
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
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-5 px-5 sm:px-8">
        <Link to="/" className="font-serif text-2xl font-semibold">Barberly</Link>
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
          barber
        </span>
        <nav className="ml-4 flex items-center gap-4">
          <NavLink to="/shop" end className={linkCls}>Onboarding</NavLink>
          <NavLink to="/shop/bookings" className={linkCls}>Schedule &amp; services</NavLink>
          <NavLink to="/shop/earnings" className={linkCls}>Earnings</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Hi <span className="text-foreground">{user?.email}</span>
          </span>
          <button
            onClick={signOut}
            className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
