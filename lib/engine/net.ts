// Street network loaded from /data/*.json (built by ridescoredc-models notebooks/ridesim/prep.py).
// Framework-free on purpose: this module must port to the RideScore no-build page.

export type PoiType = "school" | "library" | "metro" | "rec";
export interface Poi { t: PoiType; n: string; x: number; y: number; node: number; d: number }
export interface Fix { e: number; gain: number }
export type Rider = "kid" | "casual" | "commuter";

export const RIDERS: Record<Rider, { lts: number; label: string; blurb: string }> = {
  kid: { lts: 1, label: "Kid", blurb: "A 10-year-old riding alone: trails, protected lanes and the quietest streets only." },
  casual: { lts: 2, label: "Casual", blurb: "Most adults: quiet streets and bike lanes, nothing fast or wide." },
  commuter: { lts: 3, label: "Commuter", blurb: "A confident rider who tolerates some traffic, but not highways in disguise." },
};

export const LTS_INFO = [
  null,
  { name: "Calm", who: "Comfortable for almost everyone, including kids" },
  { name: "Low stress", who: "Comfortable for most adults" },
  { name: "Stressful", who: "Only for confident riders" },
  { name: "Hostile", who: "Only the most experienced riders" },
] as const;

export const SRC_LABEL: Record<string, string> = {
  ridescore_v1: "RideScore DC score for this block",
  track_rule: "Separate bike track (RideSim rule: treated as calm instead of copying the road beside it)",
  trail_rule: "Trail or path not in DDOT records (RideSim rule: treated as calm)",
  osm_class_rule: "No DDOT match (RideSim estimate from the OpenStreetMap road class)",
  footway_rule: "Sidewalk-type path (RideSim estimate)",
};

export interface Block {
  segment_id: string; route_name: string | null; function: string | null; num_lanes: number | null;
  speed_limit: number | null; bike_facility_type: string; parking_presence: string | null; slow_street: unknown;
  crash_count_5yr: number; serious_injury_count_5yr: number; fatal_count_5yr: number;
  lts_level: number; ridescore_v1: number; speed_filled: boolean;
}

export interface Net {
  nNodes: number; nEdges: number;
  lon: Float64Array; lat: Float64Array; pop: Int32Array; ward: Int8Array;
  eu: Int32Array; ev: Int32Array; elen: Float32Array; elts: Int8Array; esrc: Int8Array; ename: Int32Array; eblock: Int32Array;
  ecoords: number[][]; // flat [lon, lat, lon, lat, ...] per edge
  names: string[]; src: string[];
  // CSR adjacency: for node n, edges adjE[adjStart[n] .. adjStart[n+1]) and neighbours adjN[...]
  adjStart: Int32Array; adjE: Int32Array; adjN: Int32Array;
  totalPop: number;
  grid: Grid;
}

export interface Extras {
  blocks: Block[]; pois: Poi[]; crashes: [number, number, number, number][];
  fixes: Record<Rider, Fix[]>; meta: Record<string, unknown>; wards: GeoJSON.FeatureCollection;
}

interface Grid { x0: number; y0: number; cell: number; nx: number; ny: number; cells: Map<number, number[]> }

type RawNetwork = {
  nodes: { lon: number[]; lat: number[]; pop: number[]; ward: number[] };
  edges: [number, number, number, number, number, number, number, number[]][];
  names: string[]; src: string[];
};

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
  return r.json() as Promise<T>;
}

export async function loadNet(base = "/data"): Promise<Net> {
  const raw = await getJson<RawNetwork>(`${base}/network.json`);
  const nN = raw.nodes.lon.length, nE = raw.edges.length;
  const net: Net = {
    nNodes: nN, nEdges: nE,
    lon: Float64Array.from(raw.nodes.lon), lat: Float64Array.from(raw.nodes.lat),
    pop: Int32Array.from(raw.nodes.pop), ward: Int8Array.from(raw.nodes.ward),
    eu: new Int32Array(nE), ev: new Int32Array(nE), elen: new Float32Array(nE), elts: new Int8Array(nE),
    esrc: new Int8Array(nE), ename: new Int32Array(nE), eblock: new Int32Array(nE), ecoords: new Array(nE),
    names: raw.names, src: raw.src,
    adjStart: new Int32Array(nN + 1), adjE: new Int32Array(2 * nE), adjN: new Int32Array(2 * nE),
    totalPop: 0, grid: { x0: 0, y0: 0, cell: 0.004, nx: 0, ny: 0, cells: new Map() },
  };
  raw.edges.forEach((e, i) => {
    net.eu[i] = e[0]; net.ev[i] = e[1]; net.elen[i] = e[2]; net.elts[i] = e[3];
    net.esrc[i] = e[4]; net.ename[i] = e[5]; net.eblock[i] = e[6]; net.ecoords[i] = e[7];
  });
  // CSR adjacency (undirected; bikes may ride both ways, see About page limitations)
  const deg = new Int32Array(nN);
  for (let i = 0; i < nE; i++) { deg[net.eu[i]]++; deg[net.ev[i]]++; }
  for (let n = 0; n < nN; n++) net.adjStart[n + 1] = net.adjStart[n] + deg[n];
  const fill = net.adjStart.slice(0, nN);
  for (let i = 0; i < nE; i++) {
    const u = net.eu[i], v = net.ev[i];
    net.adjE[fill[u]] = i; net.adjN[fill[u]++] = v;
    net.adjE[fill[v]] = i; net.adjN[fill[v]++] = u;
  }
  net.totalPop = net.pop.reduce((a, b) => a + b, 0);
  buildGrid(net);
  return net;
}

export async function loadExtras(base = "/data"): Promise<Extras> {
  const [blk, pois, crashes, fixes, meta, wards] = await Promise.all([
    getJson<{ cols: string[]; rows: unknown[][] }>(`${base}/blocks.json`),
    getJson<Poi[]>(`${base}/pois.json`),
    getJson<[number, number, number, number][]>(`${base}/crashes.json`),
    getJson<Record<Rider, Fix[]>>(`${base}/fixes.json`),
    getJson<Record<string, unknown>>(`${base}/meta.json`),
    getJson<GeoJSON.FeatureCollection>(`${base}/wards.geojson`),
  ]);
  const blocks = blk.rows.map((r) => Object.fromEntries(blk.cols.map((c, i) => [c, r[i]])) as unknown as Block);
  return { blocks, pois, crashes, fixes, meta, wards };
}

function buildGrid(net: Net) {
  const g = net.grid;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let n = 0; n < net.nNodes; n++) {
    x0 = Math.min(x0, net.lon[n]); y0 = Math.min(y0, net.lat[n]);
    x1 = Math.max(x1, net.lon[n]); y1 = Math.max(y1, net.lat[n]);
  }
  g.x0 = x0; g.y0 = y0; g.nx = Math.ceil((x1 - x0) / g.cell) + 1; g.ny = Math.ceil((y1 - y0) / g.cell) + 1;
  for (let n = 0; n < net.nNodes; n++) {
    const k = cellKey(g, net.lon[n], net.lat[n]);
    const arr = g.cells.get(k);
    if (arr) arr.push(n); else g.cells.set(k, [n]);
  }
}

function cellKey(g: Grid, x: number, y: number) {
  return Math.floor((y - g.y0) / g.cell) * g.nx + Math.floor((x - g.x0) / g.cell);
}

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320 * Math.cos((38.9 * Math.PI) / 180);

/** Approximate metres between two lon/lat points (fine at city scale). */
export function distM(x1: number, y1: number, x2: number, y2: number) {
  const dx = (x2 - x1) * M_PER_DEG_LON, dy = (y2 - y1) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Nearest graph node, optionally only nodes passing `ok`. Returns -1 if none within maxM. */
export function nearestNode(net: Net, x: number, y: number, maxM = 600, ok?: (n: number) => boolean) {
  const g = net.grid;
  const cx = Math.floor((x - g.x0) / g.cell), cy = Math.floor((y - g.y0) / g.cell);
  let best = -1, bestD = maxM;
  const r = Math.ceil(maxM / (g.cell * M_PER_DEG_LAT)) + 1;
  for (let j = cy - r; j <= cy + r; j++) {
    for (let i = cx - r; i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) continue;
      const arr = g.cells.get(j * g.nx + i);
      if (!arr) continue;
      for (const n of arr) {
        if (ok && !ok(n)) continue;
        const d = distM(x, y, net.lon[n], net.lat[n]);
        if (d < bestD) { bestD = d; best = n; }
      }
    }
  }
  return best;
}

const SMALL = new Set(["of", "the", "and", "at", "on"]);
/** DDOT names arrive in capitals ("SUITLAND PARKWAY TRAIL SE"); show them in title case, keep quadrants. */
export function tidyName(n: string) {
  if (!n || n !== n.toUpperCase()) return n;
  return n.toLowerCase().split(" ").map((w, i) =>
    /^(nw|ne|sw|se)$/.test(w) ? w.toUpperCase() : i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
  ).join(" ");
}

export function edgeName(net: Net, e: number) {
  return tidyName(net.names[net.ename[e]]) || "Unnamed street";
}

export function edgeMid(net: Net, e: number): [number, number] {
  const c = net.ecoords[e];
  const k = Math.floor(c.length / 4) * 2;
  return [c[k], c[k + 1]];
}
