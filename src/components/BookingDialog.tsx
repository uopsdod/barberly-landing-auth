import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { errMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Service = Tables<"services">;
type Slot = Tables<"bookable_slots">;

// The signature M1.2 interaction: a modal over /barbers/[id]. Pick service -> day ->
// start time, then confirm calls the create_booking RPC (1 booking + N booking_slots,
// atomic). The customer never leaves the page. No payment (Stripe is M2.1).
export function BookingDialog({
  open,
  onOpenChange,
  barberName,
  services,
  freeSlots,
  currency,
  minorUnits,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  barberName: string;
  services: Service[];
  freeSlots: Slot[]; // future, not-held
  currency: string;
  minorUnits: number;
  onBooked: () => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [startSlotId, setStartSlotId] = useState("");
  const [busy, setBusy] = useState(false);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const N = service?.required_slots ?? 1;

  // reset deeper choices when a higher-level choice changes / dialog closes
  useEffect(() => {
    setDate("");
    setStartSlotId("");
  }, [serviceId]);
  useEffect(() => {
    setStartSlotId("");
  }, [date]);
  useEffect(() => {
    if (!open) {
      setServiceId("");
      setDate("");
      setStartSlotId("");
    }
  }, [open]);

  const slots = useMemo(
    () => [...freeSlots].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [freeSlots],
  );

  // a start slot is valid only if the next N slots are contiguous & free
  // (ends_at of one == starts_at of the next — no gap in the published schedule).
  function spanFrom(startId: string): Slot[] | null {
    const i = slots.findIndex((s) => s.id === startId);
    if (i < 0) return null;
    const span: Slot[] = [slots[i]];
    for (let k = 1; k < N; k++) {
      const prev = span[k - 1];
      const next = slots[i + k];
      if (!next || next.starts_at !== prev.ends_at) return null;
      span.push(next);
    }
    return span;
  }

  const validStarts = useMemo(
    () => slots.filter((s) => spanFrom(s.id) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slots, N],
  );

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const s of validStarts) set.add(format(new Date(s.starts_at), "yyyy-MM-dd"));
    return [...set];
  }, [validStarts]);

  const startsForDate = validStarts.filter(
    (s) => !date || format(new Date(s.starts_at), "yyyy-MM-dd") === date,
  );

  const span = startSlotId ? spanFrom(startSlotId) : null;

  async function confirm() {
    if (!service || !startSlotId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_booking", {
        p_service_id: service.id,
        p_start_slot_id: startSlotId,
      });
      if (error) throw error;
      toast.success("Booked — see it under My bookings.");
      onOpenChange(false);
      onBooked();
    } catch (err) {
      toast.error(errMessage(err, "Could not complete the booking."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book with {barberName}</DialogTitle>
          <DialogDescription>
            Pick a service, a day, and a start time. Times are shown in your local timezone.
          </DialogDescription>
        </DialogHeader>

        {/* 1. service */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Service</p>
          <div className="grid gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => setServiceId(s.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                  serviceId === s.id ? "border-ink bg-ink/5" : "border-border hover:border-ink"
                }`}
              >
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-xs capitalize text-muted-foreground">
                    {s.category} · {s.required_slots} slot{s.required_slots > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="font-medium">{formatMoney(s.price, currency, minorUnits)}</span>
              </button>
            ))}
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">This barber has no services yet.</p>
            )}
          </div>
        </div>

        {/* 2. day */}
        {service && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Day</p>
            {dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available start times for this service right now.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDate(d)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      date === d
                        ? "border-ink bg-ink text-primary-foreground"
                        : "border-border hover:border-ink"
                    }`}
                  >
                    {format(new Date(`${d}T00:00:00`), "EEE, MMM d")}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. start time (only valid starts are shown; each has N contiguous free slots) */}
        {service && date && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Start time</p>
            <div className="flex flex-wrap gap-2">
              {startsForDate.map((s) => {
                const selected = startSlotId === s.id;
                const inSpan = span?.some((x) => x.id === s.id) ?? false;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStartSlotId(s.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      selected
                        ? "border-ink bg-ink text-primary-foreground ring-2 ring-ink ring-offset-1"
                        : inSpan
                          ? "border-ink bg-ink/10"
                          : "border-border hover:border-ink"
                    }`}
                  >
                    {format(new Date(s.starts_at), "HH:mm")}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Only start times with {N} consecutive free slot{N > 1 ? "s" : ""} are shown.
            </p>
          </div>
        )}

        {/* summary: draw the WHOLE span so a multi-slot service is obvious */}
        {service && span && (
          <div className="rounded-xl bg-muted/60 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Your booking</span>
              <span className="font-medium">{formatMoney(service.price, currency, minorUnits)}</span>
            </div>
            <div className="mt-1 font-medium">
              {format(new Date(span[0].starts_at), "EEE, MMM d · HH:mm")}
              {"–"}
              {format(new Date(span[span.length - 1].ends_at), "HH:mm")}
              {N > 1 ? ` (${N} slots)` : ""}
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium hover:border-ink"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!service || !startSlotId || busy}
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Booking…" : "Confirm booking"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
