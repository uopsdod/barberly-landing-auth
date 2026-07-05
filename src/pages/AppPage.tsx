import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { CustomerHeader } from "@/components/CustomerHeader";
import { toast } from "sonner";

// Customer hub. Signed-in customers normally land on /barbers after auth; this page is a
// simple home with the browse / my-bookings entry points, plus the optional "become a
// shop" upgrade (not relied on anywhere else).
export default function AppPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, isShop, loading: profileLoading, refresh } = useProfile();
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/sign-in");
  }, [authLoading, user, navigate]);

  // A shop shouldn't linger on the customer page — send them to their dashboard.
  useEffect(() => {
    if (!profileLoading && isShop) navigate("/shop", { replace: true });
  }, [profileLoading, isShop, navigate]);

  if (authLoading || !user || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  async function becomeShop() {
    if (!user) return;
    setUpgrading(true);
    try {
      const { error } = await supabase.from("profiles").update({ role: "shop" }).eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast.success("You're a shop now — let's set up your barbers.");
      navigate("/shop");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open a shop");
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <CustomerHeader />
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="font-serif text-4xl md:text-5xl">Welcome to Barberly</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Browse barbers, view their work, and book a slot.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/barbers"
            className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Browse barbers
          </Link>
          <Link
            to="/bookings"
            className="inline-flex h-11 items-center rounded-full border border-border bg-background px-6 text-sm font-medium hover:border-ink"
          >
            My bookings
          </Link>
        </div>

        {role === "customer" && (
          <div className="mt-14 rounded-3xl border border-border bg-background p-8 shadow-card">
            <h2 className="font-serif text-2xl">Run a barbershop?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open a shop to list your barbers, publish services and schedules, and get paid.
            </p>
            <button
              onClick={becomeShop}
              disabled={upgrading}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {upgrading ? "Opening…" : "Become a shop"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
