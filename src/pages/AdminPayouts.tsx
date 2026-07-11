import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type OwedRow = Tables<"owed_bookings">;
type Payout = Tables<"payouts">;

type ShopInfo = {
  id: string;
  display_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
};

// Admin-only settlement builder. Reads the live owed pool (owed_bookings VIEW) +
// the payouts ledger. All writes go through admin-guarded RPCs (build_payout /
// mark_payout_transferred / cancel_payout) — the route guard is UX only.
export default function AdminPayouts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency, minorUnits } = usePlatformSettings();

  const [owed, setOwed] = useState<OwedRow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [shops, setShops] = useState<Record<string, ShopInfo>>({});
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // selection + filters
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [fShop, setFShop] = useState<string>("all");
  const [fCustomer, setFCustomer] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const money = useCallback(
    (n: number | null | undefined) => formatMoney(Number(n ?? 0), currency, minorUnits),
    [currency, minorUnits],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: owedData }, { data: payoutData }] = await Promise.all([
      supabase.from("owed_bookings").select("*").order("paid_at", { ascending: false }),
      supabase.from("payouts").select("*").order("created_at", { ascending: false }),
    ]);
    const owedRows = (owedData ?? []) as OwedRow[];
    const payoutRows = (payoutData ?? []) as Payout[];

    // Fetch the profiles we need names/bank fields for (shops + customers).
    const ids = new Set<string>();
    owedRows.forEach((r) => {
      if (r.shop_id) ids.add(r.shop_id);
      if (r.customer_id) ids.add(r.customer_id);
    });
    payoutRows.forEach((p) => ids.add(p.shop_id));
    const profileMap: Record<string, ShopInfo> = {};
    const customerMap: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, bank_account_name, bank_account_number")
        .in("id", Array.from(ids));
      (profs ?? []).forEach((p) => {
        profileMap[p.id] = {
          id: p.id,
          display_name: p.display_name,
          bank_account_name: p.bank_account_name,
          bank_account_number: p.bank_account_number,
        };
        if (p.email) customerMap[p.id] = p.email;
      });
    }

    setOwed(owedRows);
    setPayouts(payoutRows);
    setShops(profileMap);
    setCustomers(customerMap);
    // drop checkboxes whose bookings are no longer owed
    setChecked((prev) => {
      const stillOwed = new Set(owedRows.map((r) => r.booking_id));
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (v && stillOwed.has(k)) next[k] = true;
      });
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shopName = useCallback(
    (id: string | null) => (id && shops[id]?.display_name) || "(unnamed shop)",
    [shops],
  );

  // shops that currently have owed bookings (for the filter dropdown)
  const owedShopIds = useMemo(() => {
    const s = new Map<string, string>();
    owed.forEach((r) => {
      if (r.shop_id) s.set(r.shop_id, shopName(r.shop_id));
    });
    return Array.from(s.entries());
  }, [owed, shopName]);

  // apply the filter bar (UI convenience — just client-side WHERE clauses)
  const filteredOwed = useMemo(() => {
    return owed.filter((r) => {
      if (fShop !== "all" && r.shop_id !== fShop) return false;
      if (fCustomer.trim()) {
        const email = (r.customer_id && customers[r.customer_id]) || "";
        if (!email.toLowerCase().includes(fCustomer.trim().toLowerCase())) return false;
      }
      if (fFrom || fTo) {
        const d = (r.paid_at ?? "").slice(0, 10);
        if (fFrom && d < fFrom) return false;
        if (fTo && d > fTo) return false;
      }
      return true;
    });
  }, [owed, fShop, fCustomer, fFrom, fTo, customers]);

  // group the filtered owed pool by shop
  const grouped = useMemo(() => {
    const g: Record<string, OwedRow[]> = {};
    filteredOwed.forEach((r) => {
      const key = r.shop_id ?? "unknown";
      (g[key] ??= []).push(r);
    });
    return g;
  }, [filteredOwed]);

  const checkedRows = useMemo(
    () => filteredOwed.filter((r) => r.booking_id && checked[r.booking_id]),
    [filteredOwed, checked],
  );

  const totals = useMemo(() => {
    return checkedRows.reduce(
      (acc, r) => {
        acc.gross += Number(r.price ?? 0);
        acc.platform += Number(r.platform_cut ?? 0);
        acc.shop += Number(r.shop_cut ?? 0);
        return acc;
      },
      { gross: 0, platform: 0, shop: 0 },
    );
  }, [checkedRows]);

  const checkedShopIds = useMemo(
    () => new Set(checkedRows.map((r) => r.shop_id)),
    [checkedRows],
  );

  function toggle(id: string) {
    setChecked((p) => ({ ...p, [id]: !p[id] }));
  }

  function selectAllForShop(shopId: string) {
    setChecked((p) => {
      const next = { ...p };
      (grouped[shopId] ?? []).forEach((r) => {
        if (r.booking_id) next[r.booking_id] = true;
      });
      return next;
    });
  }

  async function buildPayout() {
    if (checkedRows.length === 0) {
      toast.error("Select at least one owed booking.");
      return;
    }
    if (checkedShopIds.size > 1) {
      toast.error("A payout is for ONE shop — select bookings from a single shop.");
      return;
    }
    setBusy(true);
    try {
      const ids = checkedRows.map((r) => r.booking_id).filter(Boolean) as string[];
      const { data, error } = await supabase.rpc("build_payout", {
        p_booking_ids: ids,
        p_note: note.trim() || undefined,
      });
      if (error) throw error;
      toast.success(`Payout created for ${money(totals.shop)} to the shop.`);
      setChecked({});
      setNote("");
      await load();
      void data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build payout");
    } finally {
      setBusy(false);
    }
  }

  async function markTransferred(p: Payout) {
    const ref = window.prompt("Bank transfer reference / memo (optional):") ?? undefined;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("mark_payout_transferred", {
        p_payout_id: p.id,
        p_bank_reference: ref || undefined,
      });
      if (error) throw error;
      toast.success("Marked as transferred.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark transferred");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPayout(p: Payout) {
    if (!window.confirm("Cancel this payout? Its bookings return to the owed pool.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("cancel_payout", { p_payout_id: p.id });
      if (error) throw error;
      toast.success("Payout cancelled — bookings are owed again.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel payout");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const groupIds = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-5 sm:px-8">
          <Link to="/" className="font-serif text-2xl font-semibold">
            Barberly
          </Link>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
            admin
          </span>
          <nav className="ml-4 flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">Payouts</span>
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

      <main className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Settle paid bookings that haven't been paid out yet. Build a payout for one shop,
            make the bank transfer in your banking, then record it here.
          </p>
        </div>

        {/* ── Part 1 — owed pool builder ── */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl">Owed pool</h2>

          {/* filter bar */}
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-background p-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Shop
              <select
                value={fShop}
                onChange={(e) => setFShop(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="all">All shops</option>
                {owedShopIds.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Customer email
              <input
                value={fCustomer}
                onChange={(e) => setFCustomer(e.target.value)}
                placeholder="contains…"
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Paid from
              <input
                type="date"
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Paid to
              <input
                type="date"
                value={fTo}
                onChange={(e) => setFTo(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            {(fShop !== "all" || fCustomer || fFrom || fTo) && (
              <button
                onClick={() => {
                  setFShop("all");
                  setFCustomer("");
                  setFFrom("");
                  setFTo("");
                }}
                className="h-9 rounded-full border border-border bg-background px-4 text-sm hover:border-ink"
              >
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : groupIds.length === 0 ? (
            <p className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
              Nothing owed right now. Paid bookings that haven't been paid out will appear here.
            </p>
          ) : (
            <div className="space-y-6">
              {groupIds.map((shopId) => {
                const rows = grouped[shopId];
                return (
                  <div
                    key={shopId}
                    className="overflow-hidden rounded-2xl border border-border bg-background"
                  >
                    <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
                      <span className="font-medium text-foreground">{shopName(shopId)}</span>
                      <span className="text-xs text-muted-foreground">
                        {rows.length} owed booking{rows.length === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => selectAllForShop(shopId)}
                        className="ml-auto h-8 rounded-full border border-border bg-background px-3 text-xs font-medium hover:border-ink"
                      >
                        Select all for this shop
                      </button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2"></th>
                          <th className="px-4 py-2">Barber</th>
                          <th className="px-4 py-2">Customer</th>
                          <th className="px-4 py-2">Paid</th>
                          <th className="px-4 py-2 text-right">Price</th>
                          <th className="px-4 py-2 text-right">Platform</th>
                          <th className="px-4 py-2 text-right">Shop cut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.booking_id} className="border-t border-border/40">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={!!(r.booking_id && checked[r.booking_id])}
                                onChange={() => r.booking_id && toggle(r.booking_id)}
                              />
                            </td>
                            <td className="px-4 py-2 text-foreground">{r.barber_name}</td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {(r.customer_id && customers[r.customer_id]) || "—"}
                            </td>
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
                );
              })}
            </div>
          )}

          {/* build bar */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background p-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Selected: </span>
              <span className="font-medium text-foreground">{checkedRows.length}</span>
              <span className="mx-2 text-border">|</span>
              <span className="text-muted-foreground">Gross </span>
              <span className="font-medium">{money(totals.gross)}</span>
              <span className="mx-2 text-border">·</span>
              <span className="text-muted-foreground">Platform </span>
              <span className="font-medium">{money(totals.platform)}</span>
              <span className="mx-2 text-border">·</span>
              <span className="text-muted-foreground">Shop </span>
              <span className="font-medium">{money(totals.shop)}</span>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional), e.g. July payout"
              className="h-9 flex-1 min-w-[160px] rounded-lg border border-border bg-background px-3 text-sm"
            />
            <button
              onClick={buildPayout}
              disabled={busy || checkedRows.length === 0}
              className="inline-flex h-10 items-center rounded-full bg-ink px-6 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working…" : "Build payout"}
            </button>
          </div>
          {checkedShopIds.size > 1 && (
            <p className="text-sm text-destructive">
              You've selected bookings from more than one shop. A payout covers a single shop.
            </p>
          )}
        </section>

        {/* ── Part 2 — payouts ledger ── */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl">Payout history</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : payouts.length === 0 ? (
            <p className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
              No payouts yet. Build one from the owed pool above.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">Shop</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2 text-right">#</th>
                    <th className="px-4 py-2 text-right">Gross</th>
                    <th className="px-4 py-2 text-right">Platform</th>
                    <th className="px-4 py-2 text-right">Shop cut</th>
                    <th className="px-4 py-2">Bank account</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => {
                    const bank = shops[p.shop_id];
                    return (
                      <tr key={p.id} className="border-t border-border/40 align-top">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {p.shop_name || shopName(p.shop_id)}
                          {p.note && (
                            <div className="text-xs font-normal text-muted-foreground">{p.note}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">{p.bookings_count}</td>
                        <td className="px-4 py-3 text-right">{money(p.gross)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {money(p.platform_cut)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{money(p.shop_cut)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {p.status === "cancelled" ? (
                            "—"
                          ) : bank?.bank_account_number ? (
                            <>
                              <div>{bank.bank_account_name}</div>
                              <div>{bank.bank_account_number}</div>
                            </>
                          ) : (
                            "(no bank on file)"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} at={p.marked_transferred_at} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.status === "pending_transfer" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => markTransferred(p)}
                                disabled={busy}
                                className="h-8 rounded-full bg-ink px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                              >
                                Mark transferred
                              </button>
                              <button
                                onClick={() => cancelPayout(p)}
                                disabled={busy}
                                className="h-8 rounded-full border border-border px-3 text-xs font-medium hover:border-ink disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status, at }: { status: string; at: string | null }) {
  if (status === "transferred") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Transferred{at ? ` · ${new Date(at).toLocaleDateString()}` : ""}
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Pending
    </span>
  );
}
