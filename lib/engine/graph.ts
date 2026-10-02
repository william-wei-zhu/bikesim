// Routing over the street network. Pure functions over Net.
import type { Net, BlockInfo } from "./net";

/** An edge is comfortable for the rider if its LTS is within their threshold. */
export function rideable(net: Net, e: number, threshold: number) {
  return net.elts[e] <= threshold;
}

// ---------- Routing ----------

class Heap {
  private k: number[] = []; private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k, v = this.v; const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!, lv = v.pop()!; const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

export interface Route { nodes: number[]; edges: number[]; lengthM: number; byLts: number[]; breaking: number[] }

/** Dijkstra from a to b. cost(e) returns metres-equivalent cost, or Infinity to forbid. */
export function shortest(net: Net, a: number, b: number, cost: (e: number) => number, threshold: number): Route | null {
  const dist = new Float64Array(net.nNodes).fill(Infinity);
  const prevE = new Int32Array(net.nNodes).fill(-1);
  const h = new Heap();
  dist[a] = 0; h.push(0, a);
  while (h.size) {
    const [d, n] = h.pop();
    if (d > dist[n]) continue;
    if (n === b) break;
    for (let k = net.adjStart[n]; k < net.adjStart[n + 1]; k++) {
      const e = net.adjE[k], m = net.adjN[k];
      const c = cost(e);
      if (c === Infinity) continue;
      const nd = d + c;
      if (nd < dist[m]) { dist[m] = nd; prevE[m] = e; h.push(nd, m); }
    }
  }
  if (dist[b] === Infinity) return null;
  const edges: number[] = [], nodes: number[] = [b];
  let cur = b;
  while (cur !== a) {
    const e = prevE[cur]; edges.push(e);
    cur = net.eu[e] === cur ? net.ev[e] : net.eu[e];
    nodes.push(cur);
  }
  edges.reverse(); nodes.reverse();
  const byLts = [0, 0, 0, 0, 0];
  let lengthM = 0;
  const breaking: number[] = [];
  for (const e of edges) {
    const L = net.elen[e]; lengthM += L;
    const lts = net.elts[e];
    byLts[lts] += L;
    if (!rideable(net, e, threshold)) breaking.push(e);
  }
  return { nodes, edges, lengthM, byLts, breaking };
}

/** Fastest route (shortest distance on any street) and the calmest route for this rider.
 * The calm route strongly avoids streets above the rider's comfort; if it still needs some,
 * those are the hostile stretches the rider cannot avoid. */
export function routePair(net: Net, a: number, b: number, threshold: number) {
  const fastest = shortest(net, a, b, (e) => net.elen[e], threshold);
  const PENALTY = 25;
  const calm = shortest(net, a, b, (e) => net.elen[e] * (rideable(net, e, threshold) ? 1 : PENALTY), threshold);
  return { fastest, calm };
}

/** Flatten a route into one lon/lat polyline along the travel direction, plus the edge for each segment. */
export function routeLine(net: Net, r: Route): { coords: [number, number][]; segEdge: number[] } {
  const coords: [number, number][] = [];
  const segEdge: number[] = [];
  r.edges.forEach((e, i) => {
    const c = net.ecoords[e];
    const pts: [number, number][] = [];
    for (let k = 0; k < c.length; k += 2) pts.push([c[k], c[k + 1]]);
    // edge geometry runs u -> v; flip if we travel v -> u
    if (net.eu[e] !== r.nodes[i]) pts.reverse();
    if (coords.length) pts.shift();
    for (const p of pts) {
      if (coords.length) segEdge.push(e);
      coords.push(p);
    }
  });
  return { coords, segEdge };
}

export interface Stretch { lts: number; name: string; startM: number; lengthM: number; edges: number[] }

/** Consecutive edges with the same stress level and street, in travel order. */
export function stretches(net: Net, r: Route, nameOf: (e: number) => string): Stretch[] {
  const out: Stretch[] = [];
  let at = 0;
  for (const e of r.edges) {
    const lts = net.elts[e], name = nameOf(e), L = net.elen[e];
    const last = out[out.length - 1];
    if (last && last.lts === lts && last.name === name) { last.lengthM += L; last.edges.push(e); }
    else out.push({ lts, name, startM: at, lengthM: L, edges: [e] });
    at += L;
  }
  return out;
}

export interface StretchWhy { reasons: string[]; crashes: number; serious: number; fatal: number; source: "ridescore" | "estimate" }

/** Plain-language reasons a stretch is stressful, from RideScore DC's block data (worst block wins). */
export function explainStretch(net: Net, s: Stretch, blocks: BlockInfo[]): StretchWhy {
  const seen = new Set<number>();
  let speed = 0, speedEst = false, lanes = 0, crashes = 0, serious = 0, fatal = 0;
  let facility = "", roadClass = "";
  for (const e of s.edges) {
    const b = net.eblock[e];
    if (b < 0 || seen.has(b) || !blocks[b]) continue;
    seen.add(b);
    const x = blocks[b];
    if ((x.speedLimit ?? 0) > speed) { speed = x.speedLimit ?? 0; speedEst = x.speedEstimated; }
    lanes = Math.max(lanes, x.lanes ?? 0);
    if (!facility || x.bikeFacility === "No bike lane") facility = x.bikeFacility;
    if (!roadClass && x.roadClass) roadClass = x.roadClass;
    crashes += x.crashes; serious += x.serious; fatal += x.fatal;
  }
  if (!seen.size) return { reasons: ["Not in DDOT's street records, so stress is estimated from the road type"], crashes: 0, serious: 0, fatal: 0, source: "estimate" };
  const reasons: string[] = [];
  if (speed) reasons.push(`${speed} mph speed limit${speedEst ? " (estimated)" : ""}`);
  if (lanes) reasons.push(`${lanes} travel lane${lanes > 1 ? "s" : ""}`);
  if (facility) reasons.push(facility === "No bike lane" ? "No bike lane" : facility);
  if (roadClass && /arterial|freeway|interstate/i.test(roadClass)) reasons.push(roadClass.replace("Principal/Primary", "Principal"));
  return { reasons, crashes, serious, fatal, source: "ridescore" };
}
