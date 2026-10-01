// Islands (low-stress connected components), routing and reachability. Pure functions over Net.
import type { Net, Poi, PoiType } from "./net";

/** An edge is rideable for a rider if its LTS is within their comfort, or the user "fixed" it. */
export function rideable(net: Net, e: number, threshold: number, fixed: Set<number>) {
  return net.elts[e] <= threshold || fixed.has(e);
}

export interface Islands {
  comp: Int32Array;          // node -> component root
  compPop: Map<number, number>;
  ranked: number[];          // component roots by population, desc (only populated ones)
  rankOf: Map<number, number>;
  largestPop: number;
  totalPop: number;
}

export function islands(net: Net, threshold: number, fixed: Set<number>): Islands {
  const parent = new Int32Array(net.nNodes);
  for (let i = 0; i < net.nNodes; i++) parent[i] = i;
  const find = (a: number) => {
    let r = a;
    while (parent[r] !== r) r = parent[r];
    while (parent[a] !== r) { const nx = parent[a]; parent[a] = r; a = nx; }
    return r;
  };
  for (let e = 0; e < net.nEdges; e++) {
    if (!rideable(net, e, threshold, fixed)) continue;
    const a = find(net.eu[e]), b = find(net.ev[e]);
    if (a !== b) parent[b] = a;
  }
  const comp = new Int32Array(net.nNodes);
  const compPop = new Map<number, number>();
  for (let n = 0; n < net.nNodes; n++) {
    const r = find(n);
    comp[n] = r;
    if (net.pop[n]) compPop.set(r, (compPop.get(r) || 0) + net.pop[n]);
  }
  const ranked = [...compPop.keys()].sort((a, b) => compPop.get(b)! - compPop.get(a)!);
  const rankOf = new Map(ranked.map((r, i) => [r, i]));
  return { comp, compPop, ranked, rankOf, largestPop: compPop.get(ranked[0]) || 0, totalPop: net.totalPop };
}

/** Residents who are not on the largest island. */
export function stranded(is: Islands) {
  return is.totalPop - is.largestPop;
}

/** Per ward: share of that ward's residents who are on the city's largest island. */
export function wardShares(net: Net, is: Islands) {
  const top = is.ranked[0];
  const tot = new Map<number, number>(), on = new Map<number, number>();
  for (let n = 0; n < net.nNodes; n++) {
    const p = net.pop[n];
    if (!p) continue;
    const w = net.ward[n];
    tot.set(w, (tot.get(w) || 0) + p);
    if (is.comp[n] === top) on.set(w, (on.get(w) || 0) + p);
  }
  return [1, 2, 3, 4, 5, 6, 7, 8].map((w) => ({ ward: w, pop: tot.get(w) || 0, share: (on.get(w) || 0) / (tot.get(w) || 1) }));
}

/** What a rider starting at `node` can reach without riding a stressful street. */
export function reach(net: Net, is: Islands, node: number, pois: Poi[]) {
  const root = is.comp[node];
  const counts: Record<PoiType, number> = { school: 0, library: 0, metro: 0, rec: 0 };
  const names: Record<PoiType, string[]> = { school: [], library: [], metro: [], rec: [] };
  for (const p of pois) {
    if (is.comp[p.node] === root) { counts[p.t]++; if (names[p.t].length < 50) names[p.t].push(p.n); }
  }
  return { root, residents: is.compPop.get(root) || 0, counts, names };
}

/** Changes a plan of fixes makes for one rider, against the no-fix baseline. */
export function planImpact(net: Net, threshold: number, fixed: Set<number>, pois: Poi[]) {
  const before = islands(net, threshold, new Set());
  const after = islands(net, threshold, fixed);
  const schoolsOn = (is: Islands) => pois.filter((p) => p.t === "school" && is.comp[p.node] === is.ranked[0]).length;
  return {
    before, after,
    residentsJoined: after.largestPop - before.largestPop,
    schoolsJoined: schoolsOn(after) - schoolsOn(before),
    km: [...fixed].reduce((s, e) => s + net.elen[e], 0) / 1000,
  };
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
export function shortest(net: Net, a: number, b: number, cost: (e: number) => number, threshold: number, fixed: Set<number>): Route | null {
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
    const lts = fixed.has(e) ? 1 : net.elts[e];
    byLts[lts] += L;
    if (!rideable(net, e, threshold, fixed)) breaking.push(e);
  }
  return { nodes, edges, lengthM, byLts, breaking };
}

/** Fastest route (shortest distance on any street) and the calmest route for this rider.
 * The calm route strongly avoids streets above the rider's comfort; if it still needs some,
 * those are the "breaking" blocks that a fix would open. */
export function routePair(net: Net, a: number, b: number, threshold: number, fixed: Set<number>) {
  const fastest = shortest(net, a, b, (e) => net.elen[e], threshold, fixed);
  const PENALTY = 25;
  const calm = shortest(net, a, b, (e) => net.elen[e] * (rideable(net, e, threshold, fixed) ? 1 : PENALTY), threshold, fixed);
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
