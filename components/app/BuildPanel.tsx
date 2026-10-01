"use client";
import { useMemo, useState } from "react";
import { Download, Link2, Plus, Trash2, X, Crosshair } from "lucide-react";
import { edgeName, RIDERS } from "@/lib/engine/net";
import { planImpact } from "@/lib/engine/graph";
import { Btn, Card, Stat, fmt, km } from "@/components/ui";
import type { AppCtx } from "./types";

const PER_PAGE = 12;

export function BuildPanel({ ctx }: { ctx: AppCtx }) {
  const { net, is, fixed, threshold, extras } = ctx;
  const [page, setPage] = useState(0);
  const riderWord = RIDERS[ctx.rider].label.toLowerCase();
  const impact = useMemo(() => (extras ? planImpact(net, threshold, fixed, extras.pois) : null), [net, threshold, fixed, extras]);

  // Live gains for the precomputed candidates: residents on the smaller island each block would join.
  const candidates = useMemo(() => {
    const list = extras?.fixes[ctx.rider] ?? [];
    return list
      .filter((f) => !fixed.has(f.e))
      .map((f) => {
        const a = is.comp[net.eu[f.e]], b = is.comp[net.ev[f.e]];
        const gain = a === b ? 0 : Math.min(is.compPop.get(a) || 0, is.compPop.get(b) || 0);
        return { e: f.e, gain };
      })
      .filter((f) => f.gain > 0)
      .sort((x, y) => y.gain - x.gain);
  }, [extras, ctx.rider, fixed, is, net]);
  const pages = Math.max(1, Math.ceil(candidates.length / PER_PAGE));
  const pg = Math.min(page, pages - 1);
  const shown = candidates.slice(pg * PER_PAGE, (pg + 1) * PER_PAGE);

  const plan = [...fixed];
  const exportRows = () => plan.map((e) => {
    const b = net.eblock[e] >= 0 && extras ? extras.blocks[net.eblock[e]] : null;
    return { segment_id: b?.segment_id ?? "", street: edgeName(net, e), ward: net.ward[net.eu[e]], current_lts: net.elts[e], length_m: Math.round(net.elen[e]), edge: e };
  });
  const download = (name: string, body: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const exportCsv = () => {
    const rows = exportRows();
    const head = "segment_id,street,ward,current_lts,length_m,edge";
    download("ridesim-plan.csv", [head, ...rows.map((r) => [r.segment_id, `"${r.street.replace(/"/g, '""')}"`, r.ward, r.current_lts, r.length_m, r.edge].join(","))].join("\n"), "text/csv");
  };
  const exportGeo = () => {
    const rows = exportRows();
    const fc = {
      type: "FeatureCollection",
      features: rows.map((r) => {
        const c = net.ecoords[r.edge]; const coords: number[][] = [];
        for (let k = 0; k < c.length; k += 2) coords.push([c[k], c[k + 1]]);
        return { type: "Feature", properties: { ...r, proposal: "protected bike lane (RideSim what-if)" }, geometry: { type: "LineString", coordinates: coords } };
      }),
    };
    download("ridesim-plan.geojson", JSON.stringify(fc), "application/geo+json");
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); ctx.toast("Link copied. Anyone who opens it sees your plan."); }
    catch { ctx.toast("Copy failed. Copy the address bar instead."); }
  };

  const top = candidates[0];
  return (
    <div>
      {fixed.size === 0 || !impact ? (
        <>
          <h1 className="text-[1.45rem] font-bold">
            {top ? `One block can connect ${fmt(top.gain)} more people.` : `Every island is already connected for a ${riderWord} rider.`}
          </h1>
          <p className="mt-2 text-[0.85rem] text-ink-2">
            Click any wall on the map to add a protected bike lane there. Watch the islands merge. Or start from the ranked fixes below.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-[1.45rem] font-bold">
            {impact.residentsJoined > 0
              ? `Your plan connects ${fmt(impact.residentsJoined)} more residents to the main calm network.`
              : "Your plan does not join anyone to the main calm network yet."}
          </h1>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat value={fmt(fixed.size)} label="Blocks" />
            <Stat value={km(impact.km * 1000)} label="New lanes" />
            <Stat value={`+${fmt(Math.max(0, impact.schoolsJoined))}`} label="Schools" />
          </div>
          <p className="mt-2 text-[0.75rem] text-ink-2">
            Main island: {fmt(impact.before.largestPop)} → {fmt(impact.after.largestPop)} residents
            {impact.km > 0 && impact.residentsJoined > 0 ? ` · ${fmt(impact.residentsJoined / impact.km)} residents per km` : ""}.
          </p>
        </>
      )}

      <p className="mt-3 rounded-xl border border-line px-3 py-2 text-[0.72rem] text-ink-2">
        What-if simulation, not a RideScore score. A fixed block is treated as calm for every rider.
      </p>

      {fixed.size > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-2">Your plan</p>
          <ul className="space-y-1.5">
            {plan.map((e) => (
              <li key={e} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-[0.8rem]">
                <button className="flex-1 truncate text-left font-semibold underline underline-offset-2 cursor-pointer" onClick={() => ctx.flyToEdge(e)}>{edgeName(net, e)}</button>
                <span className="font-mono text-[0.7rem]">{km(net.elen[e])}</span>
                <button aria-label={`Remove ${edgeName(net, e)}`} onClick={() => ctx.toggleFix(e)} className="grid size-8 place-items-center rounded-full hover:bg-surface cursor-pointer"><X className="size-4" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn size="sm" variant="primary" onClick={share}><Link2 className="size-3.5" /> Copy share link</Btn>
            <Btn size="sm" onClick={exportCsv}><Download className="size-3.5" /> CSV</Btn>
            <Btn size="sm" onClick={exportGeo}><Download className="size-3.5" /> GeoJSON</Btn>
            <Btn size="sm" variant="quiet" onClick={ctx.clearFixes}><Trash2 className="size-3.5" /> Clear</Btn>
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="eyebrow mb-2">Highest-impact single blocks for a {riderWord} rider</p>
        {!extras && <p className="text-[0.8rem]">Loading ranked fixes…</p>}
        {extras && !candidates.length && <Card><p className="text-[0.8rem]">No single block left that joins two populated islands. Try another rider.</p></Card>}
        <ol className="space-y-1.5">
          {shown.map((f, i) => (
            <li key={f.e} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5">
              <span className="w-6 font-mono text-[0.7rem]">{pg * PER_PAGE + i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8rem] font-semibold">{edgeName(net, f.e)}</p>
                <p className="text-[0.7rem] text-ink-2">Ward {net.ward[net.eu[f.e]] || "n/a"} · +{fmt(f.gain)} residents</p>
              </div>
              <button aria-label="Show on map" onClick={() => ctx.flyToEdge(f.e)} className="grid size-9 place-items-center rounded-full border border-line hover:border-ink cursor-pointer"><Crosshair className="size-4" /></button>
              <button aria-label="Add to plan" onClick={() => { ctx.toggleFix(f.e); ctx.flyToEdge(f.e); }} className="grid size-9 place-items-center rounded-full bg-primary text-primary-ink cursor-pointer"><Plus className="size-4" /></button>
            </li>
          ))}
        </ol>
        {pages > 1 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Btn size="sm" variant="quiet" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Prev</Btn>
            <span className="font-mono text-[0.7rem]">{String(pg * PER_PAGE + 1).padStart(2, "0")}–{String(Math.min(candidates.length, (pg + 1) * PER_PAGE)).padStart(2, "0")} of {candidates.length}</span>
            <Btn size="sm" variant="quiet" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Next</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
