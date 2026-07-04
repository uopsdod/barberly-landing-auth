import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { ShopHeader } from "@/components/ShopHeader";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Barber = Tables<"barbers">;
type Service = Tables<"services">;
type Slot = Tables<"bookable_slots">;

const CATEGORIES = ["cut", "color", "perm", "beard"] as const;

export default function ShopBookings() {
  const { user } = useAuth();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("barbers")
      .select("*")
      .eq("shop_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setBarbers(data ?? []);
        setSelected((prev) => prev || data?.[0]?.id || "");
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-cream">
      <ShopHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 sm:px-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Schedule &amp; services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit each barber's services and publish bookable time slots.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : barbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a barber in{" "}
            <a href="/shop" className="underline">
              onboarding
            </a>{" "}
            first, then come back to publish services and slots.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Barber:</span>
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
                    selected === b.id
                      ? "border-ink bg-ink text-primary-foreground"
                      : "border-border bg-background hover:border-ink"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>

            {selected && (
              <div className="grid gap-8 lg:grid-cols-2">
                <ServicesEditor barberId={selected} />
                <SlotPublisher barberId={selected} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── A. Services & price editor ──
function ServicesEditor({ barberId }: { barberId: string }) {
  const { currency, minorUnits } = usePlatformSettings();
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("cut");
  const [price, setPrice] = useState("");
  const [slots, setSlots] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", barberId)
      .order("created_at", { ascending: true });
    setServices(data ?? []);
  }, [barberId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Service name is required.");
      return;
    }
    const priceInt = Number.parseInt(price, 10);
    const slotsInt = Number.parseInt(slots, 10);
    if (!Number.isFinite(priceInt) || priceInt < 0) {
      toast.error("Price must be a whole number (no decimals, no ×100).");
      return;
    }
    if (!Number.isFinite(slotsInt) || slotsInt < 1) {
      toast.error("Required slots must be at least 1.");
      return;
    }
    setBusy(true);
    try {
      // price is stored as a WHOLE integer in platform_settings.currency (e.g. 300 = NT$300).
      // Never store cents / ×100 here — the Stripe ×100 happens only at checkout (M2.1).
      const { error } = await supabase.from("services").insert({
        barber_id: barberId,
        name: name.trim(),
        category,
        price: priceInt,
        required_slots: slotsInt,
      });
      if (error) throw error;
      setName("");
      setPrice("");
      setSlots("1");
      setCategory("cut");
      await load();
      toast.success("Service added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add service");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-card sm:p-8">
      <h2 className="font-serif text-xl text-foreground">Services &amp; price</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Prices are whole {currency} amounts. Required slots = how many consecutive time
        windows the service needs.
      </p>

      <form onSubmit={add} className="mt-5 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service name (e.g. Classic Cut)"
          className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
        />
        <div className="grid grid-cols-3 gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="h-11 rounded-full border border-border bg-background px-4 text-sm capitalize outline-none focus:border-ink"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            placeholder={`Price (${currency})`}
            className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
          />
          <input
            value={slots}
            onChange={(e) => setSlots(e.target.value)}
            inputMode="numeric"
            placeholder="Slots"
            className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-full bg-ink px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add service"}
        </button>
      </form>

      {services.length > 0 && (
        <ul className="mt-6 space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="capitalize">{s.category}</span> ·{" "}
                  {formatMoney(s.price, currency, minorUnits)} · {s.required_slots} slot
                  {s.required_slots > 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => remove(s.id)}
                className="text-xs font-medium text-destructive hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── B. Bookable slot publisher ──
function SlotPublisher({ barberId }: { barberId: string }) {
  const { slotMinutes } = usePlatformSettings();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bookable_slots")
      .select("*")
      .eq("barber_id", barberId)
      .order("starts_at", { ascending: true });
    setSlots(data ?? []);
  }, [barberId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      toast.error("Pick a date.");
      return;
    }
    const start = new Date(`${date}T${from}:00`);
    const end = new Date(`${date}T${to}:00`);
    if (!(end > start)) {
      toast.error("End time must be after start time.");
      return;
    }
    // Generate a run of consecutive slot_minutes-long windows across [from, to).
    const rows: { barber_id: string; starts_at: string; ends_at: string }[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      const next = new Date(cursor.getTime() + slotMinutes * 60_000);
      if (next > end) break;
      rows.push({
        barber_id: barberId,
        starts_at: cursor.toISOString(),
        ends_at: next.toISOString(),
      });
      cursor.setTime(next.getTime());
    }
    if (rows.length === 0) {
      toast.error(`The window is shorter than one ${slotMinutes}-minute slot.`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("bookable_slots").insert(rows);
      if (error) throw error;
      await load();
      toast.success(`Published ${rows.length} slot${rows.length > 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish slots");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("bookable_slots").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const byDay = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const day = new Date(s.starts_at).toLocaleDateString();
    (acc[day] ??= []).push(s);
    return acc;
  }, {});

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-card sm:p-8">
      <h2 className="font-serif text-xl text-foreground">Bookable slots</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Each slot is a {slotMinutes}-minute window. Publish a range and it fills with
        consecutive slots.
      </p>

      <form onSubmit={publish} className="mt-5 space-y-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">From</label>
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">To</label>
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-full bg-ink px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Publishing…" : "Publish slots"}
        </button>
      </form>

      {Object.keys(byDay).length > 0 && (
        <div className="mt-6 space-y-4">
          {Object.entries(byDay).map(([day, daySlots]) => (
            <div key={day}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {day}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => remove(s.id)}
                    title="Delete slot"
                    className="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs hover:border-destructive hover:text-destructive"
                  >
                    {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}
                    <span className="text-muted-foreground group-hover:text-destructive">×</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
