import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ShieldCheck, Zap, Lock, Star } from "lucide-react";
import heroLeft from "@/assets/hero-left.jpg";
import heroRight from "@/assets/hero-right.jpg";
import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FILTERS = ["All", "Cut", "Color", "Perm", "Beard"] as const;

const BARBERS = [
  { name: "Marco Silva", shop: "Fade Studio · Brooklyn", services: ["Cut", "Beard"], rating: 4.9, reviews: 214, from: 35, img: barber1 },
  { name: "Elena Vasquez", shop: "Rouge Salon · SoHo", services: ["Cut", "Color"], rating: 4.8, reviews: 187, from: 60, img: barber2 },
  { name: "Jae Park", shop: "Ink & Blade · East Village", services: ["Cut", "Beard"], rating: 4.9, reviews: 302, from: 45, img: barber3 },
  { name: "Aria Chen", shop: "Balayage House · Chelsea", services: ["Color", "Perm"], rating: 5.0, reviews: 156, from: 120, img: barber4 },
];

const PARTNERS = ["MAISON", "CREME&CO", "NORDLYS", "AURA", "ATELIER", "STUDIO 9"];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <TrustStrip />
      <Features />
      <Popular />
      <Footer />
    </div>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5">
        <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">Barberly</Link>
        <div className="hidden flex-1 md:block">
          <div className="relative mx-auto max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search barbers, salons, styles"
              className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-ink focus:bg-background"
            />
          </div>
        </div>
        <div className="ml-auto">
          <Link
            to="/login"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-5 py-12 md:grid-cols-12 md:py-20">
        <div className="hidden md:col-span-3 md:block">
          <div className="fade-in-up overflow-hidden rounded-3xl shadow-card">
            <img src={heroLeft} alt="Man with a modern haircut" width={768} height={960} className="h-[420px] w-full object-cover" />
          </div>
        </div>

        <div className="md:col-span-6 text-center fade-in-up">
          <span className="inline-block rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            New Look
          </span>
          <h1 className="mt-5 font-serif text-5xl leading-[1.02] md:text-6xl lg:text-7xl">
            Style with <em className="italic text-ink/80">Confident</em> Hair
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground">
            Discover great barbers and stylists near you. Book a cut, color, perm or beard trim in a few taps.
          </p>

          <div className="mx-auto mt-8 max-w-xl">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1.5 shadow-card">
              <Search className="ml-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find your stylist or search a style"
                className="h-10 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-primary-foreground hover:opacity-90">
                Search
              </button>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    filter === f
                      ? "border-ink bg-ink text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-ink/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden md:col-span-3 md:block">
          <div className="fade-in-up overflow-hidden rounded-3xl shadow-card">
            <img src={heroRight} alt="Woman with elegant styled hair" width={768} height={960} className="h-[420px] w-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="border-y border-border/60 bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-x-10 gap-y-4 px-5 py-8">
        {PARTNERS.map((p) => (
          <span key={p} className="font-serif text-lg tracking-[0.25em] text-muted-foreground/70">
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: ShieldCheck, label: "Verified Barbers" },
    { icon: Zap, label: "Instant Booking" },
    { icon: Lock, label: "Secure Payment" },
    { icon: Star, label: "Top-Rated Styles" },
  ];
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-5 text-center">
        <h2 className="font-serif text-3xl md:text-4xl">Best booking experience</h2>
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="group rounded-3xl border border-border bg-cream p-8 text-center transition hover:shadow-lift">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-card">
                <Icon className="h-6 w-6 text-ink" strokeWidth={1.6} />
              </div>
              <p className="mt-5 text-sm font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Popular() {
  const navigate = useNavigate();
  return (
    <section className="bg-cream py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl md:text-4xl">Popular</h2>
          <span className="text-sm text-muted-foreground">Featured this week</span>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BARBERS.map((b) => (
            <button
              key={b.name}
              onClick={() => navigate({ to: "/login" })}
              className="group relative overflow-hidden rounded-3xl bg-background text-left shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img src={b.img} alt={b.name} width={640} height={800} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink">
                  Popular
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-serif text-lg leading-tight">{b.name}</h3>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-ink text-ink" />
                    <span className="font-medium">{b.rating}</span>
                    <span className="text-muted-foreground">({b.reviews})</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.shop}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.services.map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-sm">
                  <span className="text-muted-foreground">from </span>
                  <span className="font-semibold">${b.from}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-10 sm:flex-row">
        <span className="font-serif text-xl">Barberly</span>
        <p className="text-sm text-muted-foreground">© 2026 Barberly</p>
      </div>
    </footer>
  );
}
