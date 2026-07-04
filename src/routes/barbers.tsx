import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/barbers")({
  component: BarbersPage,
});

function BarbersPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const role = (user.user_metadata as { role?: string } | null)?.role;
  const isShop = role === "shop";

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else navigate({ to: "/" });
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
            {isShop && (
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
                barber
              </span>
            )}
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
        <h1 className="mt-6 font-serif text-4xl md:text-5xl">
          {isShop ? "Your barber dashboard" : "Barbers near you"}
        </h1>
        <p className="mt-5 text-base text-muted-foreground">
          {isShop
            ? "理髮師後台即將上線 — 下一個里程碑會加上個人檔案、服務項目與排班管理。"
            : "附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isShop
            ? "Your barber dashboard is coming soon — profile, services & schedule arrive in the next milestone."
            : "Barbers near you are coming soon — browse & booking arrive in the next milestone."}
        </p>
      </main>
    </div>
  );
}
