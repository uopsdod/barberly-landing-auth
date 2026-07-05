import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CustomerHeader } from "@/components/CustomerHeader";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { formatMoney } from "@/lib/format";
import { errMessage } from "@/lib/errors";
import { toast } from "sonner";
import { format } from "date-fns";

type BookingRow = Tables<"bookings_with_start">;

// /bookings — the customer's own bookings (RLS: auth.uid() = customer_id). Start time is
// read from the bookings_with_start view (MIN(starts_at) over booking_slots — there is no
// start_slot_id on bookings). Cancel just sets status='cancelled'; the DB trigger frees
// the held slots (never delete booking_slots from the client).
const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Reserved", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export default function MyBookings() {
  const { currency, minorUnits } = usePlatformSettings();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [svcMap, setSvcMap] = useState<Map<string, { name: string; barber: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: bookings } = await supabase
      .from("bookings_with_start")
      .select("*")
      .order("starts_at", { ascending: false, nullsFirst: false });
    const list = bookings ?? [];
    setRows(list);

    const serviceIds = [...new Set(list.map((r) => r.service_id).filter(Boolean) as string[])];
    if (serviceIds.length) {
      const { data: svcs } = await supabase
        .from("services")
        .select("id, name, barbers(name)")
        .in("id", serviceIds);
      const m = new Map<string, { name: string; barber: string }>();
      for (const s of svcs ?? []) {
        const barber = (s as unknown as { barbers?: { name?: string } }).barbers?.name ?? "";
        m.set(s.id, { name: s.name, barber });
      }
      setSvcMap(m);
    } else {
      setSvcMap(new Map());
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancel(bookingId: string) {
    setCancelling(bookingId);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);
      if (error) throw error;
      toast.success("Booking cancelled.");
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Could not cancel the booking."));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <CustomerHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="font-serif text-4xl">My bookings</h1>

        {loading ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">You have no bookings yet.</p>
            <Link to="/barbers" className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Browse barbers
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {rows.map((r) => {
              const svc = r.service_id ? svcMap.get(r.service_id) : undefined;
              const st = STATUS[r.status ?? ""] ?? { label: r.status ?? "—", cls: "bg-muted text-muted-foreground" };
              const canCancel = r.status !== "cancelled";
              return (
                <div key={r.id ?? ""} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{svc?.barber || "Barber"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{svc?.name ?? "Service"}</p>
                    <p className="mt-1 text-sm">
                      {r.starts_at
                        ? format(new Date(r.starts_at), "EEE, MMM d · HH:mm")
                        : "Time unavailable"}
                      {r.ends_at ? `–${format(new Date(r.ends_at), "HH:mm")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-medium">{formatMoney(r.price ?? 0, currency, minorUnits)}</span>
                    {canCancel && (
                      <button
                        onClick={() => r.id && cancel(r.id)}
                        disabled={cancelling === r.id}
                        className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-ink disabled:opacity-50"
                      >
                        {cancelling === r.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
