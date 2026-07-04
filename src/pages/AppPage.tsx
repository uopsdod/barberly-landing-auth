import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

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
      // Upgrade the current user's OWN profile to a shop (RLS: profiles_update_own).
      // Never writes 'admin' — that is promoted by a migration only.
      const { error } = await supabase
        .from("profiles")
        .update({ role: "shop" })
        .eq("id", user.id);
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

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else navigate("/");
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5">
          <Link to="/" className="font-serif text-2xl font-semibold">Barberly</Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Hi <span className="text-foreground">{user.email}</span>
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

      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        <span className="inline-block rounded-full border border-border bg-background px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Coming soon
        </span>
        <h1 className="mt-6 font-serif text-4xl md:text-5xl">Barbers near you</h1>
        <p className="mt-5 text-base text-muted-foreground">
          附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Barbers near you are coming soon — browse &amp; booking arrive in the next milestone.
        </p>

        {role === "customer" && (
          <div className="mt-10 rounded-3xl border border-border bg-background p-8 shadow-card">
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
