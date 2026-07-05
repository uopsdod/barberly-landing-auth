import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CustomerHeader } from "@/components/CustomerHeader";

type Barber = Tables<"barbers">;
type Photo = Tables<"barber_photos">;

const BUCKET = "barber-photos";
const CATEGORIES = ["all", "cut", "color", "perm", "beard"] as const;
const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// /barbers — public marketplace grid of every barber. Reads M1.1's barbers (+ a rep
// photo from barber_photos, + services for the category filter). Anyone can browse;
// booking requires sign-in (handled on the detail page).
export default function Barbers() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cats, setCats] = useState<{ barber_id: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: b }, { data: p }, { data: s }] = await Promise.all([
        supabase.from("barbers").select("*").order("created_at", { ascending: true }),
        supabase.from("barber_photos").select("*"),
        supabase.from("services").select("barber_id, category"),
      ]);
      if (!active) return;
      setBarbers(b ?? []);
      setPhotos(p ?? []);
      setCats((s ?? []) as { barber_id: string; category: string }[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // rep photo per barber: featured first, then lowest sort_order.
  const repPhoto = useMemo(() => {
    const map = new Map<string, Photo>();
    for (const ph of [...photos].sort(
      (a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order,
    )) {
      if (!map.has(ph.barber_id)) map.set(ph.barber_id, ph);
    }
    return map;
  }, [photos]);

  const catsByBarber = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of cats) {
      if (!map.has(c.barber_id)) map.set(c.barber_id, new Set());
      map.get(c.barber_id)!.add((c.category ?? "").toLowerCase());
    }
    return map;
  }, [cats]);

  const filtered = barbers.filter((b) => {
    const text = `${b.name} ${b.address ?? ""} ${b.intro ?? ""}`.toLowerCase();
    const matchesQ = !q.trim() || text.includes(q.trim().toLowerCase());
    const matchesCat = cat === "all" || (catsByBarber.get(b.id)?.has(cat) ?? false);
    return matchesQ && matchesCat;
  });

  return (
    <div className="min-h-screen bg-cream">
      <CustomerHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <h1 className="font-serif text-4xl">Find your barber</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse barbers, view their work, and book a slot.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or address…"
            className="h-11 w-full rounded-full border border-border bg-background px-5 text-sm outline-none focus:border-ink"
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition ${
                  cat === c
                    ? "border-ink bg-ink text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">No barbers match your search.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => {
              const ph = repPhoto.get(b.id);
              return (
                <Link
                  key={b.id}
                  to={`/barbers/${b.id}`}
                  className="group overflow-hidden rounded-3xl border border-border bg-background shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    {ph ? (
                      <img
                        src={publicUrl(ph.storage_path)}
                        alt={b.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                        No photo yet
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="font-serif text-xl">{b.name}</h2>
                    {b.address && <p className="mt-1 text-xs text-muted-foreground">{b.address}</p>}
                    {b.intro && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{b.intro}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
