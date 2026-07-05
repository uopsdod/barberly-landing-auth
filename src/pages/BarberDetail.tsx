import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CustomerHeader } from "@/components/CustomerHeader";
import { BookingDialog } from "@/components/BookingDialog";
import { useAuth } from "@/lib/auth-context";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Barber = Tables<"barbers">;
type Photo = Tables<"barber_photos">;
type Service = Tables<"services">;
type Slot = Tables<"bookable_slots">;

const BUCKET = "barber-photos";
const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// /barbers/[id] — marketplace-style product detail: photo carousel + profile + services
// + available slots + a Book button that opens a modal (BookingDialog). Availability is
// derived via a NOT EXISTS anti-join against booking_slots (a slot with a booking_slots
// row is held); slots themselves have no status.
export default function BarberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currency, minorUnits } = usePlatformSettings();

  const [barber, setBarber] = useState<Barber | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [freeSlots, setFreeSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const nowIso = new Date().toISOString();
    const [{ data: b }, { data: p }, { data: s }, { data: slots }, { data: held }] =
      await Promise.all([
        supabase.from("barbers").select("*").eq("id", id).maybeSingle(),
        supabase.from("barber_photos").select("*").eq("barber_id", id),
        supabase.from("services").select("*").eq("barber_id", id).order("price", { ascending: true }),
        supabase
          .from("bookable_slots")
          .select("*")
          .eq("barber_id", id)
          .gt("starts_at", nowIso)
          .order("starts_at", { ascending: true }),
        supabase.from("booking_slots").select("slot_id"),
      ]);
    if (!b) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const heldSet = new Set((held ?? []).map((h) => h.slot_id));
    setBarber(b);
    setPhotos(
      (p ?? []).sort(
        (a, c) => Number(c.is_featured) - Number(a.is_featured) || a.sort_order - c.sort_order,
      ),
    );
    setServices(s ?? []);
    setFreeSlots((slots ?? []).filter((sl) => !heldSet.has(sl.id)));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const upcoming = useMemo(() => freeSlots.slice(0, 10), [freeSlots]);

  function onBookClick() {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    setBookingOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <CustomerHeader />
        <p className="mt-24 text-center text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (notFound || !barber) {
    return (
      <div className="min-h-screen bg-cream">
        <CustomerHeader />
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <h1 className="font-serif text-3xl">Barber not found</h1>
          <Link to="/barbers" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            Back to barbers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <CustomerHeader />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <Link to="/barbers" className="text-sm text-muted-foreground hover:text-foreground">← All barbers</Link>

        {/* photo carousel */}
        <div className="mt-4">
          {photos.length > 0 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {photos.map((ph) => (
                  <CarouselItem key={ph.id}>
                    <button
                      type="button"
                      onClick={() => setZoom(publicUrl(ph.storage_path))}
                      className="block w-full overflow-hidden rounded-3xl border border-border bg-muted"
                    >
                      <img
                        src={publicUrl(ph.storage_path)}
                        alt={ph.caption ?? barber.name}
                        className="aspect-[16/10] w-full cursor-zoom-in object-cover"
                      />
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && (
                <>
                  <CarouselPrevious className="left-3" />
                  <CarouselNext className="right-3" />
                </>
              )}
            </Carousel>
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center rounded-3xl border border-border bg-muted text-sm text-muted-foreground">
              No photos yet
            </div>
          )}
          {photos.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((ph) => (
                <img
                  key={ph.id}
                  src={publicUrl(ph.storage_path)}
                  alt=""
                  onClick={() => setZoom(publicUrl(ph.storage_path))}
                  className="h-14 w-14 cursor-pointer rounded-lg border border-border object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {/* profile + book */}
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl">{barber.name}</h1>
            {barber.address && <p className="mt-1 text-sm text-muted-foreground">{barber.address}</p>}
            {barber.intro && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{barber.intro}</p>}
          </div>
          <button
            onClick={onBookClick}
            className="inline-flex h-12 items-center rounded-full bg-ink px-8 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Book
          </button>
        </div>

        {/* services */}
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Services</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {s.category} · {s.required_slots} slot{s.required_slots > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="font-medium">{formatMoney(s.price, currency, minorUnits)}</span>
              </div>
            ))}
            {services.length === 0 && <p className="text-sm text-muted-foreground">No services published yet.</p>}
          </div>
        </section>

        {/* available slots preview */}
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Available slots</h2>
          {freeSlots.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No open slots right now — check back soon.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {upcoming.map((sl) => (
                  <span key={sl.id} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                    {format(new Date(sl.starts_at), "EEE MMM d · HH:mm")}
                  </span>
                ))}
              </div>
              {freeSlots.length > upcoming.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  +{freeSlots.length - upcoming.length} more — open Book to see all.
                </p>
              )}
            </>
          )}
        </section>
      </main>

      {/* zoom lightbox */}
      <Dialog open={!!zoom} onOpenChange={(v) => !v && setZoom(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          {zoom && <img src={zoom} alt="" className="max-h-[80vh] w-full rounded-2xl object-contain" />}
        </DialogContent>
      </Dialog>

      {/* booking modal — stays on this page */}
      <BookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        barberName={barber.name}
        services={services}
        freeSlots={freeSlots}
        currency={currency}
        minorUnits={minorUnits}
        onBooked={load}
      />
    </div>
  );
}
