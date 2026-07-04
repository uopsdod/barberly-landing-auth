import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { ShopHeader } from "@/components/ShopHeader";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Barber = Tables<"barbers">;
type Photo = Tables<"barber_photos">;

const BUCKET = "barber-photos";

export default function ShopOnboarding() {
  const { user } = useAuth();
  const { profile, refresh: refreshProfile } = useProfile();

  // ── A. Payout settings (shop-level, written to profiles) ──
  const [shopName, setShopName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    setShopName(profile?.display_name ?? "");
    setBankName(profile?.bank_account_name ?? "");
    setBankNumber(profile?.bank_account_number ?? "");
  }, [profile?.display_name, profile?.bank_account_name, profile?.bank_account_number]);

  // display_name (shop name) + both bank fields are ALL required to finish onboarding.
  const payoutMissing =
    !profile?.display_name || !profile?.bank_account_name || !profile?.bank_account_number;

  async function savePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!shopName.trim()) {
      toast.error("Shop name is required.");
      return;
    }
    if (!bankName.trim() || !bankNumber.trim()) {
      toast.error("Bank account name and number are both required.");
      return;
    }
    setSavingPayout(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: shopName.trim(),
          bank_account_name: bankName.trim(),
          bank_account_number: bankNumber.trim(),
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Payout details saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save payout details");
    } finally {
      setSavingPayout(false);
    }
  }

  // ── B. My barbers (one shop → many barbers) ──
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(true);

  const loadBarbers = useCallback(async () => {
    if (!user) return;
    setLoadingBarbers(true);
    const { data } = await supabase
      .from("barbers")
      .select("*")
      .eq("shop_id", user.id)
      .order("created_at", { ascending: true });
    setBarbers(data ?? []);
    setLoadingBarbers(false);
  }, [user]);

  useEffect(() => {
    void loadBarbers();
  }, [loadBarbers]);

  return (
    <div className="min-h-screen bg-cream">
      <ShopHeader />

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-10 sm:px-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Shop onboarding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your payout account, list your barbers, and upload portfolio photos.
          </p>
          {!payoutMissing && barbers.length > 0 && (
            <Link
              to="/shop/bookings"
              className="mt-3 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to schedule &amp; services →
            </Link>
          )}
        </div>

        {/* A. Payout settings */}
        <section className="rounded-3xl border border-border bg-background p-6 shadow-card sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">Payout settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your shop name and the bank account where your shop gets paid.{" "}
                <span className="font-medium text-foreground">Use test data first.</span>
              </p>
            </div>
            {payoutMissing && (
              <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-destructive/10 px-2.5 text-xs font-medium text-destructive">
                Required
              </span>
            )}
          </div>

          <form onSubmit={savePayout} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Shop name <span className="text-destructive">*</span>
              </label>
              <input
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="mt-2 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
                placeholder="e.g. Downtown Cuts"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Your shop's name, shown on payout records. This is the shop name — not an individual barber's name.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Bank account name <span className="text-destructive">*</span>
              </label>
              <input
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="mt-2 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
                placeholder="e.g. Barberly Test Shop"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Bank account number <span className="text-destructive">*</span>
              </label>
              <input
                required
                value={bankNumber}
                onChange={(e) => setBankNumber(e.target.value)}
                className="mt-2 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
                placeholder="e.g. 0000-0000-0000"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={savingPayout}
                className="h-11 rounded-full bg-ink px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {savingPayout ? "Saving…" : "Save payout details"}
              </button>
            </div>
          </form>
        </section>

        {/* B + C. My barbers + photos */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-foreground">My barbers</h2>
              <p className="text-sm text-muted-foreground">
                One shop can list many barbers. Add as many as you run.
              </p>
            </div>
            <AddBarberButton shopId={user?.id} onAdded={loadBarbers} />
          </div>

          {loadingBarbers ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : barbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No barbers yet. Add your first barber to start building a profile.
            </p>
          ) : (
            <div className="space-y-4">
              {barbers.map((b) => (
                <BarberCard key={b.id} barber={b} onChanged={loadBarbers} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Add-a-barber inline form ──
function AddBarberButton({ shopId, onAdded }: { shopId?: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    if (!name.trim()) {
      toast.error("Barber name is required.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("barbers")
        .insert({ shop_id: shopId, name: name.trim() });
      if (error) throw error;
      setName("");
      setOpen(false);
      onAdded();
      toast.success("Barber added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add barber");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-ink"
      >
        + Add another barber
      </button>
    );
  }

  return (
    <form onSubmit={add} className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Barber name"
        className="h-10 w-48 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? "…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </form>
  );
}

// ── One barber: editable profile + photo manager ──
function BarberCard({ barber, onChanged }: { barber: Barber; onChanged: () => void }) {
  const [name, setName] = useState(barber.name);
  const [intro, setIntro] = useState(barber.intro ?? "");
  const [address, setAddress] = useState(barber.address ?? "");
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== barber.name ||
    intro !== (barber.intro ?? "") ||
    address !== (barber.address ?? "");

  async function save() {
    if (!name.trim()) {
      toast.error("Barber name is required.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("barbers")
        .update({
          name: name.trim(),
          intro: intro.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", barber.id);
      if (error) throw error;
      onChanged();
      toast.success("Barber updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update barber");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete barber "${barber.name}"? This also removes their services, slots and photos.`,
      )
    )
      return;
    const { error } = await supabase.from("barbers").delete().eq("id", barber.id);
    if (error) toast.error(error.message);
    else {
      onChanged();
      toast.success("Barber deleted.");
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-background p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Address
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-2 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-ink"
            placeholder="Optional"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Intro
          </label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-ink"
            placeholder="Optional — a short bio for this barber."
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="h-10 rounded-full bg-ink px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          onClick={remove}
          className="h-10 rounded-full border border-border px-4 text-sm font-medium text-destructive hover:border-destructive"
        >
          Delete
        </button>
      </div>

      <BarberPhotos barberId={barber.id} />
    </div>
  );
}

// ── Sample hairstyle photos for one barber ──
function BarberPhotos({ barberId }: { barberId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("barber_photos")
      .select("*")
      .eq("barber_id", barberId)
      .order("sort_order", { ascending: true });
    setPhotos(data ?? []);
  }, [barberId]);

  useEffect(() => {
    void load();
  }, [load]);

  function publicUrl(path: string) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        // Path MUST start with '<barber_id>/' so the Storage write-own policy authorizes it.
        const path = `${barberId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase
          .from("barber_photos")
          .insert({ barber_id: barberId, storage_path: path, sort_order: photos.length });
        if (rowErr) throw rowErr;
      }
      await load();
      toast.success("Photos uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function toggleFeatured(photo: Photo) {
    const { error } = await supabase
      .from("barber_photos")
      .update({ is_featured: !photo.is_featured })
      .eq("id", photo.id);
    if (error) toast.error(error.message);
    else load();
  }

  async function removePhoto(photo: Photo) {
    const { error: sErr } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    if (sErr) {
      toast.error(sErr.message);
      return;
    }
    const { error: rErr } = await supabase.from("barber_photos").delete().eq("id", photo.id);
    if (rErr) toast.error(rErr.message);
    else load();
  }

  return (
    <div className="mt-6 border-t border-border/60 pt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Sample hairstyle photos</h3>
        <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-ink">
          {uploading ? "Uploading…" : "+ Upload photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={onUpload}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No photos yet — upload this barber's past work.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-border">
              <img
                src={publicUrl(p.storage_path)}
                alt={p.caption ?? "Sample hairstyle"}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              {p.is_featured && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  Featured
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => toggleFeatured(p)}
                  className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium hover:bg-background"
                >
                  {p.is_featured ? "Unfeature" : "Feature"}
                </button>
                <button
                  onClick={() => removePhoto(p)}
                  className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-destructive hover:bg-background"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
