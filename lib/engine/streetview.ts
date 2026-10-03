// Street View ride, smoothed:
// - three stacked StreetViewPanoramas in a ring: one visible, two preloading the photos ahead
// - each new photo fades in on top of the previous one (no brightness dip)
// - between photos the visible one "dollies" forward with a GPU CSS scale (no tile refetch, no flicker)
// - drag to look around (yaw/pitch offset from the direction of travel), double-click to reset
// Billing: three panorama loads per Street View session (Google bills per StreetViewPanorama created);
// moving them (setPano) adds no loads, so cost does not depend on distance.
// Photos are looked up with StreetViewService limited to official Google, outdoor imagery, so a ride never
// cuts to an indoor shot or a user-uploaded photo sphere (setPosition alone takes the nearest of any kind).
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export interface Look { yaw: number; pitch: number }

export interface StreetViewHandle {
  /** Call every ride frame with the rider's distance along the route and travel heading. */
  follow(distM: number, heading: number): void;
  /** How far the ride may advance right now (waits at a photo boundary until the next photo has loaded). */
  maxDistance(): number;
  destroy(): void;
}

const SLOTS = 3;
const STEP_M = 11;          // distance between photos (Google's photos are roughly 8 to 12 m apart)
const FADE_MS = 700;        // new photo fades in on top of the old
const DOLLY = 0.16;         // CSS scale gained while riding from one photo to the next
/** Fixed panorama zoom (changing it mid-ride refetches tiles). Phones zoom in: portrait screens are narrow,
 * and a wide lens makes the street and the rider tiny. */
export const streetViewZoom = (narrow: boolean) => (narrow ? 1.5 : 0.8);
/** Horizontal field of view for a zoom (Google: fov = 180 / 2^zoom); the 3D rider overlay uses the same lens. */
export const streetViewHfov = (narrow: boolean) => 180 / Math.pow(2, streetViewZoom(narrow));
/** Panorama pitch when looking straight ahead. */
export const STREETVIEW_BASE_PITCH = -3;
let optionsSet = false;

type Pano = google.maps.StreetViewPanorama;
// none: no outdoor Google photo near this point (the panorama still holds an older photo, so status alone can't tell).
interface Slot { el: HTMLDivElement; pano: Pano; ready: boolean; panoId: string; target: number; none: boolean; req: number }

export async function createStreetView(
  host: HTMLElement, apiKey: string, pointAt: (d: number) => [number, number], startDist: number, heading: number,
  onCoverage: (hasPhotos: boolean) => void, onLook: (look: Look) => void, zoom = streetViewZoom(false),
): Promise<StreetViewHandle> {
  if (!optionsSet) { setOptions({ key: apiKey, v: "weekly" }); optionsSet = true; }
  const { StreetViewPanorama, StreetViewService, StreetViewSource, StreetViewPreference } = await importLibrary("streetView");
  const service = new StreetViewService();

  let z = 1;
  const slots: Slot[] = Array.from({ length: SLOTS }, (_, i) => {
    const el = document.createElement("div");
    // pointer-events off: we handle dragging ourselves so the rider overlay can turn with the view.
    el.style.cssText = `position:absolute;inset:0;opacity:${i === 0 ? 1 : 0};z-index:${i === 0 ? z : 0};` +
      `transition:opacity ${FADE_MS}ms ease-in-out;transform-origin:50% 46%;will-change:transform,opacity;pointer-events:none;`;
    host.appendChild(el);
    const pano = new StreetViewPanorama(el, {
      disableDefaultUI: true, clickToGo: false, linksControl: false, showRoadLabels: false,
      motionTracking: false, motionTrackingControl: false, scrollwheel: false, zoom,
      pov: { heading, pitch: -3 },
    });
    return { el, pano, ready: false, panoId: "", target: 0, none: false, req: 0 };
  });
  let front = 0;                 // visible slot
  let stepStart = startDist;     // distance where the visible photo was taken
  let travel = heading;          // smoothed direction of travel
  const look: Look = { yaw: 0, pitch: 0 };
  const listeners: google.maps.MapsEventListener[] = [];
  const at = (k: number) => slots[(front + k) % SLOTS];
  const applyPov = () => {
    const pov = { heading: travel + look.yaw, pitch: STREETVIEW_BASE_PITCH + look.pitch };
    for (const s of slots) s.pano.setPov(pov);
  };

  const hasPhoto = (slot: Slot) => !slot.none && slot.pano.getStatus() === "OK";
  const load = (slot: Slot, d: number) => {
    slot.ready = false; slot.panoId = ""; slot.target = d; slot.none = false;
    const req = ++slot.req;
    const [x, y] = pointAt(d);
    service.getPanorama({
      location: { lng: x, lat: y }, radius: 40, preference: StreetViewPreference.NEAREST,
      sources: [StreetViewSource.GOOGLE, StreetViewSource.OUTDOOR], // intersection: official and outdoor
    }).then(({ data }) => {
      if (req !== slot.req) return; // superseded by a newer load
      const id = data.location?.pano;
      if (!id) throw new Error("no pano");
      if (id === slot.pano.getPano()) { slot.panoId = id; slot.ready = true; return; } // same photo: no status event
      slot.pano.setPano(id);
    }).catch(() => {
      if (req !== slot.req) return;
      slot.none = true; slot.ready = true; // no outdoor photo here: don't hold the ride
      if (slot === slots[front]) onCoverage(false);
    });
  };
  for (const slot of slots) {
    listeners.push(slot.pano.addListener("status_changed", () => {
      const ok = hasPhoto(slot);
      if (slot === slots[front]) onCoverage(ok);
      // Let the first tiles paint before this photo is allowed to fade in.
      if (ok) window.setTimeout(() => { slot.ready = true; slot.panoId = slot.pano.getPano(); }, 300);
      else slot.ready = true; // no photo here: don't hold the ride
    }));
  }
  slots.forEach((s, i) => load(s, startDist + i * STEP_M));

  const advance = () => {
    const old = at(0), next = at(1);
    // Where photos are sparse the next slot can hold the same photo: swap instantly at the same scale
    // (nothing visible changes) and let the dolly keep going.
    const duplicate = !!next.panoId && next.panoId === old.panoId;
    if (duplicate) {
      next.el.style.transition = "none";
      next.el.style.transform = old.el.style.transform;
    } else {
      next.el.style.transform = "scale(1)";
      stepStart = next.target;
    }
    next.el.style.zIndex = String(++z);
    next.el.style.opacity = "1";
    front = (front + 1) % SLOTS;
    onCoverage(hasPhoto(next));
    // After the fade, recycle the old slot to preload the photo after the last one in the ring.
    window.setTimeout(() => {
      next.el.style.transition = `opacity ${FADE_MS}ms ease-in-out`;
      old.el.style.opacity = "0"; old.el.style.zIndex = "0";
      load(old, at(SLOTS - 2).target + STEP_M);
    }, duplicate ? 0 : FADE_MS + 50);
  };

  // Drag to look around; the rider overlay turns with it via onLook.
  let drag: { x: number; y: number; id: number } | null = null;
  const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; host.style.cursor = "grabbing"; try { host.setPointerCapture(e.pointerId); } catch { /* ok */ } };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    look.yaw = Math.max(-150, Math.min(150, look.yaw - (e.clientX - drag.x) * 0.25));
    look.pitch = Math.max(-25, Math.min(25, look.pitch + (e.clientY - drag.y) * 0.15));
    drag.x = e.clientX; drag.y = e.clientY;
    applyPov(); // also works while the ride is paused
    onLook({ ...look });
  };
  const up = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) { drag = null; host.style.cursor = "grab"; } };
  const reset = () => { look.yaw = 0; look.pitch = 0; applyPov(); onLook({ ...look }); };
  host.style.cursor = "grab";
  host.style.touchAction = "none";
  host.addEventListener("pointerdown", down); host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", up); host.addEventListener("pointercancel", up);
  host.addEventListener("dblclick", reset);

  return {
    follow(distM, h) {
      const next = at(1);
      if (next.ready && distM >= next.target) advance();
      const d = ((h - travel + 540) % 360) - 180;
      travel += d * 0.08;
      applyPov();
      const progress = Math.min(1, Math.max(0, (distM - stepStart) / STEP_M));
      at(0).el.style.transform = `scale(${1 + DOLLY * progress})`;
    },
    maxDistance() {
      const next = at(1);
      return next.ready ? Infinity : next.target + STEP_M * 0.3;
    },
    destroy() {
      listeners.forEach((l) => l.remove());
      host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up); host.removeEventListener("pointercancel", up);
      host.removeEventListener("dblclick", reset);
      host.style.cursor = ""; host.style.touchAction = "";
      for (const s of slots) { s.pano.setVisible(false); s.el.remove(); }
    },
  };
}
