// First-person fly-through along a route polyline. Camera follows a rider dot with a smoothed heading.
import type * as maplibregl from "maplibre-gl";
import { distM } from "./net";

export interface RideFrame { distM: number; totalM: number; edgeIdx: number }

export class Ride {
  private cum: number[] = [];
  private edgeAt: number[] = [];
  private raf = 0;
  private last = 0;
  private bearing: number | null = null;
  d = 0;
  playing = false;
  speed = 1; // multiplier on base speed

  constructor(
    private map: maplibregl.Map,
    private coords: [number, number][],
    vertexEdge: number[], // edge index for each segment [i, i+1]
    private onFrame: (f: RideFrame) => void,
    private onEnd: () => void,
  ) {
    this.cum = [0];
    for (let i = 1; i < coords.length; i++) this.cum.push(this.cum[i - 1] + distM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]));
    this.edgeAt = vertexEdge;
  }

  get total() { return this.cum[this.cum.length - 1]; }

  /** Base speed scales with route length so any ride takes roughly 35 to 60 seconds. */
  private get mps() { return Math.max(60, Math.min(220, this.total / 45)) * this.speed; }

  private pointAt(d: number): { p: [number, number]; seg: number } {
    const c = this.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
    const L = c[hi] - c[lo] || 1, t = Math.min(1, Math.max(0, (d - c[lo]) / L));
    const a = this.coords[lo], b = this.coords[hi];
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], seg: lo };
  }

  private render() {
    const { p, seg } = this.pointAt(this.d);
    const ahead = this.pointAt(Math.min(this.total, this.d + 70)).p;
    const target = (Math.atan2((ahead[0] - p[0]) * Math.cos((p[1] * Math.PI) / 180), ahead[1] - p[1]) * 180) / Math.PI;
    if (this.bearing === null) this.bearing = target;
    let diff = ((target - this.bearing + 540) % 360) - 180;
    this.bearing += diff * 0.08;
    diff = 0;
    this.map.jumpTo({ center: p, bearing: this.bearing, pitch: 70, zoom: 17.2 });
    const src = this.map.getSource("rs-rider") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }] });
    this.onFrame({ distM: this.d, totalM: this.total, edgeIdx: this.edgeAt[seg] ?? -1 });
  }

  play() {
    if (this.playing) return;
    if (this.d >= this.total) this.d = 0;
    this.playing = true;
    this.last = performance.now();
    const step = (t: number) => {
      if (!this.playing) return;
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.d = Math.min(this.total, this.d + dt * this.mps);
      this.render();
      if (this.d >= this.total) { this.playing = false; this.onEnd(); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  pause() { this.playing = false; cancelAnimationFrame(this.raf); }

  seek(fraction: number) {
    this.d = Math.max(0, Math.min(1, fraction)) * this.total;
    this.bearing = null;
    this.render();
  }

  stop() {
    this.pause();
    const src = this.map.getSource("rs-rider") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }
}
