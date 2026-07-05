import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type Mode = "signin" | "signup";
type Role = "customer" | "shop";

export default function LoginPage({ initialMode = "signin" }: { initialMode?: Mode }) {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Route by persisted profiles.role after auth (not a blanket /app):
  // shop → /shop, admin → /admin/payouts (built in M2.2), else customer → /app.
  // Fixing this at the source stops a shop landing on the customer page (and,
  // later, an admin stranded away from the payout page).
  async function redirectByRole(fallback: Role | "admin" = "customer") {
    const { data: userData } = await supabase.auth.getUser();
    let userRole: string | null = null;
    if (userData.user) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      userRole = data?.role ?? null;
    }
    const effective = userRole ?? fallback;
    navigate(
      effective === "shop" ? "/shop" : effective === "admin" ? "/admin/payouts" : "/barbers",
      { replace: true },
    );
  }

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!loading && session) void redirectByRole();
  }, [session, loading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: `${window.location.origin}/barbers`,
          },
        });
        if (error) throw error;
        toast.success("Welcome to Barberly!");
        await redirectByRole(role);
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
      await redirectByRole();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5">
          <Link to="/" className="font-serif text-2xl font-semibold">Barberly</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-5 py-16">
        <div className="text-center">
          <h1 className="font-serif text-4xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to book your next appointment." : "Join Barberly — as a customer or barber."}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-background p-6 shadow-card sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-full border border-border bg-secondary/60 p-1 text-sm">
            <button
              type="button"
              onClick={() => { setMode("signin"); navigate("/sign-in"); }}
              className={`rounded-full py-2 font-medium transition ${mode === "signin" ? "bg-background shadow-card" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); navigate("/sign-up"); }}
              className={`rounded-full py-2 font-medium transition ${mode === "signup" ? "bg-background shadow-card" : "text-muted-foreground"}`}
            >
              Sign up
            </button>
          </div>

          {mode === "signup" && (
            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                I am a
              </label>
              <div className="grid grid-cols-2 rounded-full border border-border bg-secondary/60 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  className={`rounded-full py-2 font-medium transition ${role === "customer" ? "bg-ink text-primary-foreground" : "text-foreground"}`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setRole("shop")}
                  className={`rounded-full py-2 font-medium transition ${role === "shop" ? "bg-ink text-primary-foreground" : "text-foreground"}`}
                >
                  Barber
                </button>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
                placeholder="At least 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
