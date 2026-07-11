import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { ShopHeader } from "@/components/ShopHeader";
import { formatMoney } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type OwedRow = Tables<"owed_bookings">;
type Payout = Tables<"payouts">;

// Read-only mirror of the shop's own earnings — owed (not yet in a payout) vs
// already in a payout (with that payout's status). Scoped to the signed-in shop by
// RLS; a shop can never build or mark a payout — only the admin can.
export default function ShopEarnings() {
  const { user } = useAuth();
  const { currency, minorUnits } = usePlatformSettings();

  const [owed, setOwed] = useState<OwedRow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const money = useCallback(
    (n: number | null | undefined) => formatMoney(Number(n ?? 0), currency, minorUnits),
    [currency, minorUnits],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: owedData }, { data: payoutData }] = await Promise.all([
      supabase
        .from("owed_bookings")
        .select("*")
        .eq("shop_id", user.id)
        .order("paid_at", { ascending: false }),
      supabase
        .from("payouts")
        .select("*")
        .eq("shop_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setOwed((owedData ?? []) as OwedRow[]);
    setPayouts((payoutData ?? []) as Payout[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // A cancelled payout's bookings have reverted to owed — don't show them here.
  const activePayouts = useMemo(
    () => payouts.filter((p) => p.status !== "cancelled"),
    [payouts],
  );

  const owedTotal = useMemo(
    () => owed.reduce((s, r) => s + Number(r.shop_cut ?? 0), 0),
    [owed],
  );
  const pendingTotal = useMemo(
    () =>
      activePayouts
        .filter((p) => p.status === "pending_transfer")
        .reduce((s, p) => s + p.shop_cut, 0),
    [activePayouts],
  );
  const transferredTotal = useMemo(
    () =>
      activePayouts
        .filter((p) => p.status === "transferred")
        .reduce((s, p) => s + p.shop_cut, 0),
    [activePayouts],
  );

  return (
    <div className="min-h-screen bg-cream">
      <ShopHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:px-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Earnings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your share of paid bookings, across all your barbers. We settle and pay out your
            earnings in batches.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Owed (not yet paid out)" value={money(owedTotal)} />
              <SummaryCard label="In a pending payout" value={money(pendingTotal)} />
              <SummaryCard label="Transferred to you" value={money(transferredTotal)} />
            </div>

            {/* owed */}
            <section className="space-y-3">
              <h2 className="font-serif text-2xl">尚未撥款 / Owed</h2>
              {owed.length === 0 ? (
                <p className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
                  Nothing owed right now.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-background">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2">Barber</th>
                        <th className="px-4 py-2">Paid</th>
                        <th className="px-4 py-2 text-right">Price</th>
                        <th className="px-4 py-2 text-right">Platform</th>
                        <th className="px-4 py-2 text-right">Your cut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owed.map((r) => (
                        <tr key={r.booking_id} className="border-t border-border/40">
                          <td className="px-4 py-2 text-foreground">{r.barber_name}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">{money(r.price)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {money(r.platform_cut)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">{money(r.shop_cut)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* in a payout */}
            <section className="space-y-3">
              <h2 className="font-serif text-2xl">已納入撥款 / In a payout</h2>
              {activePayouts.length === 0 ? (
                <p className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
                  No payouts yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-background">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2">Created</th>
                        <th className="px-4 py-2 text-right">Bookings</th>
                        <th className="px-4 py-2 text-right">Gross</th>
                        <th className="px-4 py-2 text-right">Your cut</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePayouts.map((p) => (
                        <tr key={p.id} className="border-t border-border/40">
                          <td className="px-4 py-2 text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right">{p.bookings_count}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {money(p.gross)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">{money(p.shop_cut)}</td>
                          <td className="px-4 py-2">
                            {p.status === "transferred" ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                已轉帳 / Transferred
                                {p.marked_transferred_at
                                  ? ` · ${new Date(p.marked_transferred_at).toLocaleDateString()}`
                                  : ""}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                待轉帳 / Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-2xl text-foreground">{value}</div>
    </div>
  );
}
