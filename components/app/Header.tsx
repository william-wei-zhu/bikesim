"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Settings, Info, MapPin, ChevronDown, Check, UserRound } from "lucide-react";
import { CITIES, type City } from "@/lib/cities";
import { authConfigured } from "@/lib/auth";
import { useAccount } from "@/components/useAccount";
import { AuthSheet } from "@/components/AuthSheet";

/** Site header. On a city's map, the logo resets that map and the city chip switches cities. */
export function Header({ city }: { city?: City }) {
  return (
    <header className="relative z-40 border-b border-line bg-paper">
      <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-5">
        <Link href={city ? `/${city.slug}` : "/"} className="flex shrink-0 items-center gap-2.5" aria-label={city ? `BikeSim ${city.short} home` : "BikeSim home"}
          // Already on the map: Next keeps the page mounted, so tell it to reset to the start screen.
          onClick={() => window.dispatchEvent(new Event("rs-home"))}>
          <Image src="/brand/bikesim-mark-512.png" alt="" width={40} height={40} className="size-10 rounded-[10px]" priority />
          <span className="hidden font-display text-[1.25rem] font-bold tracking-tight sm:inline">BikeSim</span>
        </Link>
        {city && <CitySwitcher city={city} />}
        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <Link href="/about" aria-label="About" className={`${city ? "hidden sm:inline-flex" : "inline-flex"} min-h-10 items-center gap-1.5 rounded-full border-2 border-ink px-3 text-[0.78rem] font-semibold hover:bg-surface md:px-4`}>
            <Info className="size-4" aria-hidden /> <span className="hidden md:inline">About</span>
          </Link>
          <Link href="/settings" aria-label="Settings" className="grid size-10 place-items-center rounded-full border-2 border-ink hover:bg-surface">
            <Settings className="size-4" />
          </Link>
          {authConfigured && <AccountButton />}
        </div>
      </div>
    </header>
  );
}

function CitySwitcher({ city }: { city: City }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" aria-label={`City: ${city.name}. Change city`}
        className="inline-flex min-h-10 max-w-[10rem] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[0.82rem] font-semibold hover:border-ink cursor-pointer">
        <MapPin className="size-4 shrink-0" aria-hidden /> <span className="truncate">{city.short}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div role="listbox" aria-label="Cities" className="absolute left-0 top-12 z-40 max-h-[70vh] w-64 overflow-y-auto rounded-card border border-line bg-paper p-1.5 shadow-panel animate-in fade-in slide-in-from-top-1 duration-150">
          {CITIES.filter((c) => c.live).map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} onClick={() => setOpen(false)} role="option" aria-selected={c.slug === city.slug}
              className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[0.9rem] hover:bg-surface">
              <span className="flex-1 font-semibold">{c.name}</span>
              <span className="font-mono text-[0.76rem] text-ink-2">{c.state}</span>
              {c.slug === city.slug && <Check className="size-4 text-accent" aria-hidden />}
            </Link>
          ))}
          <Link href="/" onClick={() => setOpen(false)} className="mt-1 flex min-h-10 items-center justify-center rounded-xl border-t border-line text-[0.82rem] font-semibold hover:bg-surface">All cities</Link>
        </div>
      )}
    </div>
  );
}

function AccountButton() {
  const { account, known } = useAccount();
  const [sheet, setSheet] = useState(false);
  if (!known) return <span className="size-10" aria-hidden />;
  if (account) {
    const initial = (account.name || account.email || "?").trim()[0]?.toUpperCase();
    return (
      <Link href="/settings#account" aria-label={`Account: ${account.email ?? account.name ?? "signed in"}`}
        className="grid size-10 place-items-center overflow-hidden rounded-full border-2 border-ink bg-surface font-display text-[0.95rem] font-bold">
        {account.photo
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL, tiny, not worth the image optimizer
          ? <img src={account.photo} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          : initial}
      </Link>
    );
  }
  return (
    <>
      <button onClick={() => setSheet(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[0.78rem] font-semibold text-primary-ink hover:opacity-90 cursor-pointer md:px-4">
        <UserRound className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign in</span>
      </button>
      {sheet && <AuthSheet reason="account" onDone={() => setSheet(false)} onClose={() => setSheet(false)} />}
    </>
  );
}
