// First-person fly-through along a route polyline. Camera follows a rider dot with a smoothed heading.
import type * as maplibregl from "maplibre-gl";
import { distM } from "./net";

export interface RideFrame { distM: number; totalM: number; edgeIdx: number; pos: [number, number]; heading: number }

export class Ride {
  private cum: number[] = [];
  private edgeAt: number[] = [];
  private raf = 0;
  private last = 0;
  private bearing: number | null = null;
  d = 0;
  playing = false;
  /** Camera the user can orbit around the rider: bearing offset from the travel direction, pitch, zoom. */
  orbit = { bearing: 0, pitch: 72, zoom: 18.2 };
  private detachOrbit: (() => void) | null = null;
  /** Last rendered frame, so a view switched on mid-ride can start where the rider is. */
  current: RideFrame | null = null;
  speed = 1; // multiplier on base speed
  maxMps = Infinity; // Street View caps speed so photos can keep up
  /** Optional cap on how far the ride may advance (Street View holds at a photo boundary until it has loaded). */
  limit: (() => number) | null = null;

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
  /** 1x pace. Halved on 2026-10-02 (the old "Slow" is the new 1x): about 18 km/h in Street View, 30 to 110 m/s in 3D. */
  private get mps() { return Math.min(this.maxMps, Math.max(60, Math.min(220, this.total / 45))) * 0.5 * this.speed; }

  /** Lon/lat at a distance along the route. */
  positionAt(d: number): [number, number] { return this.pointAt(Math.max(0, Math.min(this.total, d))).p; }

  private pointAt(d: number): { p: [number, number]; seg: number } {
    const c = this.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
    const L = c[hi] - c[lo] || 1, t = Math.min(1, Math.max(0, (d - c[lo]) / L));
    const a = this.coords[lo], b = this.coords[hi];
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], seg: lo };
  }

  render() {
    const { p, seg } = this.pointAt(this.d);
    const ahead = this.pointAt(Math.min(this.total, this.d + 70)).p;
    const target = (Math.atan2((ahead[0] - p[0]) * Math.cos((p[1] * Math.PI) / 180), ahead[1] - p[1]) * 180) / Math.PI;
    if (this.bearing === null) this.bearing = target;
    const diff = ((target - this.bearing + 540) % 360) - 180;
    this.bearing += diff * 0.08;
    // Low enough to ride between buildings; padding puts the bike in the lower third, road ahead visible.
    const h = this.map.getCanvas().clientHeight;
    const o = this.orbit;
    this.map.jumpTo({ center: p, bearing: this.bearing + o.bearing, pitch: o.pitch, zoom: o.zoom, padding: { top: h * 0.45 * (o.pitch / 72), bottom: 0, left: 0, right: 0 } });
    this.current = { distM: this.d, totalM: this.total, edgeIdx: this.edgeAt[seg] ?? -1, pos: p, heading: this.bearing ?? 0 };
    this.onFrame(this.current);
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
      this.d = Math.min(this.total, this.d + dt * this.mps, this.limit ? Math.max(this.d, this.limit()) : Infinity);
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

  /** Drag to orbit around the rider (left/right turns, up/down tilts), wheel to zoom, double-click to reset.
   * The rider stays centered; MapLibre's own pan/rotate handlers are paused during the ride. */
  enableOrbit() {
    if (this.detachOrbit) return;
    const map = this.map, el = map.getCanvasContainer();
    const handlers = [map.dragPan, map.dragRotate, map.scrollZoom, map.doubleClickZoom, map.touchZoomRotate, map.touchPitch, map.keyboard];
    const wasOn = handlers.map((h) => h.isEnabled());
    handlers.forEach((h) => h.disable());
    let drag: { x: number; y: number; id: number } | null = null;
    const redraw = () => { if (!this.playing) this.render(); };
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone; dragging still works without capture */ }
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.orbit.bearing = (this.orbit.bearing + (e.clientX - drag.x) * 0.35) % 360;
      this.orbit.pitch = Math.max(20, Math.min(80, this.orbit.pitch - (e.clientY - drag.y) * 0.25));
      drag.x = e.clientX; drag.y = e.clientY;
      redraw();
    };
    const up = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) { drag = null; el.style.cursor = "grab"; } };
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.orbit.zoom = Math.max(15.5, Math.min(19.5, this.orbit.zoom - e.deltaY * 0.002)); redraw(); };
    const reset = () => { this.orbit = { bearing: 0, pitch: 72, zoom: 18.2 }; redraw(); };
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false }); el.addEventListener("dblclick", reset);
    this.detachOrbit = () => {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel); el.removeEventListener("dblclick", reset);
      el.style.cursor = "";
      handlers.forEach((h, i) => { if (wasOn[i]) h.enable(); });
      this.detachOrbit = null;
    };
  }

  disableOrbit() { this.detachOrbit?.(); }

  stop() {
    this.disableOrbit();
    this.pause();
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  }
}
