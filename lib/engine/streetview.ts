// Street View ride, smoothed: two stacked StreetViewPanoramas. The hidden one preloads the photo ~STEP_M ahead,
// then the two crossfade; between swaps the visible photo slowly zooms in, so it feels like moving forward.
// Billing: two panorama loads per ride ("Dynamic Street View"); setPosition on an existing panorama adds no loads.
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export interface StreetViewHandle {
  /** Call every ride frame with the rider's distance along the route, position lookup and heading. */
  follow(distM: number, heading: number): void;
  /** How far the ride may advance right now (waits at a photo boundary until the next photo has loaded). */
  maxDistance(): number;
  destroy(): void;
}

const STEP_M = 15;          // distance between photos we step through
const FADE_MS = 450;        // crossfade length
const ZOOM_FROM = 0.4, ZOOM_TO = 1.3; // forward "dolly" between photos
let optionsSet = false;

type Pano = google.maps.StreetViewPanorama;
interface Slot { el: HTMLDivElement; pano: Pano; ready: boolean; panoId: string; target: number }

export async function createStreetView(
  host: HTMLElement, apiKey: string, pointAt: (d: number) => [number, number], startDist: number, heading: number,
  onCoverage: (hasPhotos: boolean) => void,
): Promise<StreetViewHandle> {
  if (!optionsSet) { setOptions({ key: apiKey, v: "weekly" }); optionsSet = true; }
  const { StreetViewPanorama } = await importLibrary("streetView");

  const make = (z: number): Slot => {
    const el = document.createElement("div");
    el.style.cssText = `position:absolute;inset:0;transition:opacity ${FADE_MS}ms ease;opacity:${z === 0 ? 1 : 0};`;
    host.appendChild(el);
    const pano = new StreetViewPanorama(el, {
      disableDefaultUI: true, clickToGo: false, linksControl: false, showRoadLabels: false,
      motionTracking: false, motionTrackingControl: false, scrollwheel: false, zoom: ZOOM_FROM,
      pov: { heading, pitch: -3 },
    });
    return { el, pano, ready: false, panoId: "", target: 0 };
  };
  const slots = [make(0), make(1)];
  let front = 0;                 // index of the visible slot
  let stepStart = startDist;     // distance where the visible photo was taken
  let pov = heading;
  const listeners: google.maps.MapsEventListener[] = [];

  const load = (slot: Slot, d: number) => {
    slot.ready = false; slot.target = d;
    const [x, y] = pointAt(d);
    slot.pano.setPosition({ lng: x, lat: y });
  };
  for (const slot of slots) {
    listeners.push(slot.pano.addListener("status_changed", () => {
      const ok = slot.pano.getStatus() === "OK";
      if (slot === slots[front]) onCoverage(ok);
      // A short settle delay lets the first tiles paint before we fade to this photo.
      if (ok) window.setTimeout(() => { slot.ready = true; slot.panoId = slot.pano.getPano(); }, 180);
      else slot.ready = true; // no photo here: don't hold the ride
    }));
  }
  load(slots[0], startDist);
  load(slots[1], startDist + STEP_M);

  const swap = () => {
    const back = slots[1 - front];
    // Same photo as the visible one (photos are sparse here): skip ahead instead of fading to a duplicate.
    if (back.panoId && back.panoId === slots[front].panoId) { load(back, back.target + STEP_M); return; }
    back.pano.setZoom(ZOOM_FROM);
    back.el.style.opacity = "1";
    slots[front].el.style.opacity = "0";
    stepStart = back.target;
    front = 1 - front;
    onCoverage(slots[front].pano.getStatus() === "OK");
    const hidden = slots[1 - front];
    window.setTimeout(() => load(hidden, stepStart + STEP_M), FADE_MS);
  };

  return {
    follow(distM, h) {
      const back = slots[1 - front];
      if (back.ready && distM >= back.target) swap();
      // Smooth turn toward the direction of travel; both slots share the view direction.
      const d = ((h - pov + 540) % 360) - 180;
      pov += d * 0.1;
      const progress = Math.min(1, Math.max(0, (distM - stepStart) / STEP_M));
      const vis = slots[front].pano;
      vis.setPov({ heading: pov, pitch: -3 });
      vis.setZoom(ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * progress);
      slots[1 - front].pano.setPov({ heading: pov, pitch: -3 });
    },
    maxDistance() {
      const back = slots[1 - front];
      return back.ready ? Infinity : back.target + STEP_M * 0.25;
    },
    destroy() {
      listeners.forEach((l) => l.remove());
      for (const s of slots) { s.pano.setVisible(false); s.el.remove(); }
    },
  };
}
