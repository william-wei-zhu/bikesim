"use client";
import { ArrowRight, Bike, RotateCcw, Share2, X } from "lucide-react";
import type { Route } from "@/lib/engine/graph";
import { km } from "@/components/ui";
import type { RouteKind } from "./types";

const BAR = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];

/** End of a ride: what it felt like, and the other route as the obvious next ride. */
export function FinishCard({ kind, ridden, other, onRideOther, onRideAgain, onShare, onClose }: {
  kind: RouteKind; ridden: Route; other: Route;
  onRideOther: () => void; onRideAgain: () => void; onShare: () => void; onClose: () => void;
}) {
  const hostile = ridden.byLts[4];
  const otherHostile = other.byLts[4];
  const same = other.edges.join() === ridden.edges.join();
  const calmer = kind === "short" && !same && otherHostile < hostile;
  const saved = hostile - otherHostile;

  return (
    // Sits where the trip panel was (left on desktop, bottom sheet on phones) so the whole route stays visible.
    <section role="dialog" aria-labelledby="finish-title"
      className="absolute inset-x-0 bottom-0 z-30 max-h-[68%] overflow-y-auto rounded-t-3xl border border-line bg-paper p-5 shadow-panel animate-in fade-in slide-in-from-bottom-4 duration-500 md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[420px] md:rounded-card md:slide-in-from-left-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="eyebrow">Ride complete</p>
            <h2 id="finish-title" className="mt-1 text-[1.25rem] font-bold leading-tight md:text-[1.5rem]">
              {hostile < 20 ? "Calm almost the whole way." : `${km(hostile)} of that was hostile.`}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-2 text-[0.95rem]">
          You rode the {kind === "short" ? "shortest" : "lowest-stress"} route: <span className="font-semibold">{km(ridden.lengthM)}</span>.
        </p>
        <div className="mt-3 flex h-3.5 overflow-hidden rounded-full" aria-label="Distance by stress level">
          {[1, 2, 3, 4].map((l) => ridden.byLts[l] > 0 && (
            <div key={l} className={BAR[l]} style={{ width: `${(ridden.byLts[l] / ridden.lengthM) * 100}%` }} />
          ))}
        </div>

        {calmer && (
          <div className="mt-3 rounded-card border border-line bg-surface p-3 md:mt-4 md:p-4">
            <p className="eyebrow">A calmer way exists</p>
            <p className="mt-1 text-[0.95rem] font-semibold md:text-[1rem]">
              The lowest-stress route is {km(other.lengthM)}, with {otherHostile < 20 ? "almost no" : `only ${km(otherHostile)} of`} hostile riding.
            </p>
            <p className="mt-1 hidden text-[0.85rem] text-ink-2 md:block">
              {km(Math.max(0, other.lengthM - ridden.lengthM))} longer, {km(saved)} less riding next to fast, heavy traffic.
            </p>
          </div>
        )}
        {calmer && (
          <button onClick={onRideOther}
            className="rs-ride-cta group mt-3 flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.98rem] font-bold text-white">
            <Bike className="size-5 shrink-0" aria-hidden /> Ride the lowest-stress route
            <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
          </button>
        )}
        {kind === "calm" && !same && other.byLts[4] > hostile && (
          <p className="mt-4 rounded-card border border-line bg-surface p-4 text-[0.95rem]">
            The shortest route is {km(other.lengthM)} but has {km(other.byLts[4] - hostile)} more hostile riding. You avoided it.
          </p>
        )}

        <div className={"mt-4 grid grid-cols-2 gap-2"}>
          <button onClick={onRideAgain} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-ink px-3 text-[0.85rem] font-semibold hover:bg-surface">
            <RotateCcw className="size-4" aria-hidden /> Ride again
          </button>
          <button onClick={onShare} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-ink px-3 text-[0.85rem] font-semibold hover:bg-surface">
            <Share2 className="size-4" aria-hidden /> Share this ride
          </button>
        </div>
    </section>
  );
}
