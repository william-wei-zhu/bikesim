"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, LogOut, Trash2, UserRound } from "lucide-react";
import { Btn } from "@/components/ui";
import { AuthSheet } from "@/components/AuthSheet";
import { useAccount } from "@/components/useAccount";
import { authConfigured, deleteAccount, deleteTrip, listTrips, signOut, DAILY_STREETVIEW_RIDES, type SavedTrip } from "@/lib/auth";
import { getCity } from "@/lib/cities";

const tripHref = (t: SavedTrip) =>
  `/${t.city}?from=${t.from.x},${t.from.y},${encodeURIComponent(t.from.label)}&to=${t.to.x},${t.to.y},${encodeURIComponent(t.to.label)}`;

/** Account row in Settings: sign in or out, saved trips, delete everything. */
export function AccountSection() {
  const { account, known } = useAccount();
  const [sheet, setSheet] = useState(false);
  const [trips, setTrips] = useState<SavedTrip[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    let live = true;
    listTrips().then((t) => live && setTrips(t)).catch(() => live && setTrips([]));
    return () => { live = false; };
  }, [account]);

  if (!authConfigured) return null;
  return (
    <section id="account" className="mt-4 scroll-mt-24 rounded-card border border-line bg-surface p-5">
      <h2 className="text-[1.15rem] font-bold">Account</h2>
      {!known ? <div className="mt-3 h-11" aria-hidden /> : !account ? (
        <>
          <p className="mt-1 text-[0.9rem] text-ink-2">Not signed in. Sign in to keep riding in Street View ({DAILY_STREETVIEW_RIDES} rides a day) and to save your trips.</p>
          <Btn variant="primary" className="mt-3" onClick={() => setSheet(true)}><UserRound className="size-4" aria-hidden /> Sign in</Btn>
          {sheet && <AuthSheet reason="account" onDone={() => setSheet(false)} onClose={() => setSheet(false)} />}
        </>
      ) : (
        <>
          <p className="mt-1 text-[0.9rem] text-ink-2">Signed in as <span className="font-semibold text-ink">{account.email ?? account.name}</span>.</p>

          <h3 className="mt-5 flex items-center gap-2 text-[1rem] font-bold"><Bookmark className="size-4" aria-hidden /> Saved trips</h3>
          {trips === null ? <p className="mt-2 text-[0.9rem] text-ink-2">Loading…</p>
            : trips.length === 0 ? <p className="mt-2 text-[0.9rem] text-ink-2">No saved trips yet. Plan a trip and press Save.</p>
            : (
              <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-paper">
                {trips.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <Link href={tripHref(t)} className="min-w-0 flex-1 underline-offset-4 hover:underline">
                      <span className="block truncate font-semibold">{t.label}</span>
                      <span className="block text-[0.8rem] text-ink-2">{getCity(t.city)?.name ?? t.city}</span>
                    </Link>
                    <button aria-label={`Delete ${t.label}`} onClick={async () => { await deleteTrip(t.id); setTrips((x) => x?.filter((y) => y.id !== t.id) ?? null); }}
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-line hover:border-ink cursor-pointer">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Btn size="sm" onClick={() => signOut()}><LogOut className="size-4" aria-hidden /> Sign out</Btn>
            {!confirmDelete
              ? <Btn size="sm" variant="quiet" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" aria-hidden /> Delete account</Btn>
              : (
                <div role="alert" className="w-full rounded-card border border-line bg-paper p-4">
                  <p className="text-[0.9rem] font-semibold">Delete your account and all saved trips? This can&apos;t be undone.</p>
                  <div className="mt-3 flex gap-2">
                    <Btn size="sm" variant="primary" onClick={async () => {
                      try { await deleteAccount(); setMsg("Your account and saved trips are deleted."); }
                      catch { setMsg("For your security, sign out, sign in again, then delete within a few minutes."); }
                      setConfirmDelete(false);
                    }}>Delete everything</Btn>
                    <Btn size="sm" onClick={() => setConfirmDelete(false)}>Keep my account</Btn>
                  </div>
                </div>
              )}
          </div>
        </>
      )}
      {msg && <p role="status" className="mt-3 text-[0.9rem] font-semibold">{msg}</p>}
    </section>
  );
}
