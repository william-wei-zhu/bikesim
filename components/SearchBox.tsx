"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import type { Poi } from "@/lib/engine/net";
import type { City } from "@/lib/cities";

export interface Place { label: string; x: number; y: number }

/** Address search: instant matches from the city's schools / libraries / transit / rec centers, then the geocoder. */
export function SearchBox({ city, placeholder, pois, value, onPick, onClear, autoFocus }: {
  city: City; placeholder: string; pois: Poi[]; value?: Place | null; onPick: (p: Place) => void; onClear?: () => void; autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "empty">("idle");
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const POI_LABEL: Record<string, string> = { school: "School", library: "Library", metro: city.transit, rec: "Rec center" };
  const local: Place[] = q.trim().length >= 2
    ? pois.filter((p) => p.n.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5)
        .map((p) => ({ label: `${p.n} (${POI_LABEL[p.t]})`, x: p.x, y: p.y }))
    : [];
  const results = [...local, ...remote];

  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) return;
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      setStatus("loading");
      try {
        const r = await fetch(`/api/geocode?city=${city.slug}&q=${encodeURIComponent(t)}`, { signal: ctl.signal });
        const j = await r.json();
        if (!r.ok) { setStatus("error"); setMsg(j.error || "Search failed."); setRemote([]); return; }
        setRemote(j.results);
        setStatus(j.results.length ? "idle" : "empty");
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setStatus("error"); setMsg("Search failed. Pick a spot on the map instead."); }
      }
    }, 450);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q, city.slug]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (p: Place) => { onPick(p); setQ(""); setRemote([]); setOpen(false); setStatus("idle"); };

  if (value) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-paper px-4">
        <MapPin className="size-4 shrink-0 text-accent-ink" aria-hidden />
        <span className="flex-1 truncate text-[0.82rem] font-semibold">{value.label}</span>
        {onClear && (
          <button onClick={onClear} aria-label="Clear place" className="grid size-8 place-items-center rounded-full hover:bg-surface cursor-pointer">
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <div className="flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-paper px-4 focus-within:border-ink">
        <Search className="size-4 shrink-0" aria-hidden />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); if (e.target.value.trim().length < 3) { setRemote([]); setStatus("idle"); } }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && results[active]) pick(results[active]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2 text-[0.85rem] text-ink outline-none placeholder:text-ink-2"
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-paper shadow-panel">
          {results.map((r, i) => (
            <button key={r.label + i} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}
              className={`block w-full px-4 py-2.5 text-left text-[0.8rem] leading-snug cursor-pointer ${i === active ? "bg-surface" : "hover:bg-surface"}`}>
              {r.label}
            </button>
          ))}
          {status === "loading" && <p className="px-4 py-2.5 text-[0.78rem] text-ink-2">Searching {city.short} addresses…</p>}
          {status === "empty" && !local.length && <p className="px-4 py-2.5 text-[0.78rem] text-ink-2">No {city.short} match. Try a street address, or pick a spot on the map.</p>}
          {status === "error" && <p className="px-4 py-2.5 text-[0.78rem] text-ink-2">{msg}</p>}
        </div>
      )}
    </div>
  );
}
