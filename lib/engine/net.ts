// Street network loaded from /data/<city>/*.json (DC: ridescoredc-models notebooks/ridesim/prep.py;
// other cities: the bikesim-data pipeline, same schema).
// Framework-free on purpose: this module must port to the RideScore no-build page.

export type PoiType = "school" | "library" | "metro" | "rec";
export interface Poi { t: PoiType; n: string; x: number; y: number; node: number; d: number }

/** RideSim simulates a confident everyday commuter: comfortable up to LTS 3, avoids hostile LTS 4 streets. */
export const COMMUTER_LTS = 3;

export const LTS_INFO = [
  null,
  { name: "Calm", who: "Comfortable for almost everyone, including kids" },
  { name: "Low stress", who: "Comfortable for most adults" },
  { name: "Stressful", who: "Only for confident riders" },
  { name: "Hostile", who: "Only the most experienced riders" },
] as const;

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

interface Grid { x0: number; y0: number; cell: number; nx: number; ny: number; cells: Map<number, number[]> }

type RawNetwork = {
  nodes: { lon: number[]; lat: number[]; pop?: number[]; ward?: number[] };
  edges: [number, number, number, number, number, number, number, number[]][];
  names: string[]; src: string[];
};

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
  return r.json() as Promise<T>;
}

export async function loadNet(base: string): Promise<Net> {
  const raw = await getJson<RawNetwork>(`${base}/network.json`);
  const nN = raw.nodes.lon.length, nE = raw.edges.length;
  const net: Net = {
    nNodes: nN, nEdges: nE,
    lon: Float64Array.from(raw.nodes.lon), lat: Float64Array.from(raw.nodes.lat),
    pop: Int32Array.from(raw.nodes.pop ?? []), ward: Int8Array.from(raw.nodes.ward ?? []),
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

/** Named places (schools, libraries, transit stations, rec centers) for instant search suggestions. */
export async function loadPois(base: string): Promise<Poi[]> {
  return getJson<Poi[]>(`${base}/pois.json`);
}

/** Street facts for one block (from blocks.json, indexed by Net.eblock). DC: RideScore DC's DDOT blocks.
 *  Crash counts are null where the city's data has none. */
export interface BlockInfo {
  speedLimit: number | null; speedEstimated: boolean; lanes: number | null; bikeFacility: string;
  roadClass: string | null; crashes: number | null; serious: number; fatal: number;
}

/** Loaded on demand (first "why" tap) so it never slows the first page load. */
export async function loadBlocks(base: string): Promise<BlockInfo[]> {
  const raw = await getJson<{ cols: string[]; rows: unknown[][] }>(`${base}/blocks.json`);
  const c = (name: string) => raw.cols.indexOf(name);
  const [sp, sf, ln, bf, fn, cr, se, fa] = ["speed_limit", "speed_filled", "num_lanes", "bike_facility_type", "function",
    "crash_count_5yr", "serious_injury_count_5yr", "fatal_count_5yr"].map(c);
  return raw.rows.map((r) => ({
    speedLimit: (r[sp] as number | null) ?? null, speedEstimated: !!r[sf], lanes: (r[ln] as number | null) ?? null,
    bikeFacility: String(r[bf] ?? "No bike lane"), roadClass: (r[fn] as string | null) ?? null,
    crashes: cr < 0 || r[cr] == null ? null : Number(r[cr]), serious: Number(r[se] ?? 0), fatal: Number(r[fa] ?? 0),
  }));
}

function buildGrid(net: Net) {
  const g = net.grid;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let n = 0; n < net.nNodes; n++) {
    x0 = Math.min(x0, net.lon[n]); y0 = Math.min(y0, net.lat[n]);
    x1 = Math.max(x1, net.lon[n]); y1 = Math.max(y1, net.lat[n]);
  }
  setLatitude((y0 + y1) / 2);
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
// Metres per degree of longitude shrink with latitude; set from the loaded city's network.
let M_PER_DEG_LON = 111_320 * Math.cos((38.9 * Math.PI) / 180);
function setLatitude(lat: number) { M_PER_DEG_LON = 111_320 * Math.cos((lat * Math.PI) / 180); }

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
/** Some sources send names in capitals (DDOT: "SUITLAND PARKWAY TRAIL SE"); show them in title case, keep DC quadrants. */
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
