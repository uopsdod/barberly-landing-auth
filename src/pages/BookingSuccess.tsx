import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CustomerHeader } from "@/components/CustomerHeader";

// /bookings/success — UX ONLY. Polls this booking's status until the webhook flips it to `paid`.
// The webhook (not this page) is the source of truth: the customer may close the browser right
// after paying, so we must NEVER write `paid` here — we only read.
export default function BookingSuccess() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const { data } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", bookingId)
        .single();
      if (!active) return;
      const s = data?.status ?? null;
      setStatus(s);
      if (s !== "paid") timer = setTimeout(poll, 1500); // keep polling until the webhook lands
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bookingId]);

  const paid = status === "paid";

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        {paid ? (
          <>
            <h1 className="font-serif text-3xl text-foreground">Payment received 🎉</h1>
            <p className="mt-3 text-muted-foreground">
              Your booking is confirmed. You can see it under My bookings.
            </p>
            <Link
              to="/bookings"
              className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              View my bookings
            </Link>
          </>
        ) : (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-ink" />
            <h1 className="mt-6 font-serif text-2xl text-foreground">Processing payment…</h1>
            <p className="mt-2 text-muted-foreground">
              Hang tight — we're confirming your payment with the bank. This page updates itself.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
