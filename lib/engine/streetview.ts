// Street View ride: a Google StreetViewPanorama that follows the rider, facing the direction of travel.
// Billing: one panorama load per ride ("Dynamic Street View"); moving it with setPosition adds no loads.
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { distM } from "./net";

export interface StreetViewHandle {
  /** Call every ride frame; hops to a new photo only after moving HOP_M, turns smoothly every frame. */
  follow(pos: [number, number], heading: number): void;
  destroy(): void;
}

const HOP_M = 18;
let optionsSet = false;

export async function createStreetView(
  el: HTMLElement, apiKey: string, start: [number, number], heading: number,
  onCoverage: (hasPhotos: boolean) => void,
): Promise<StreetViewHandle> {
  if (!optionsSet) { setOptions({ key: apiKey, v: "weekly" }); optionsSet = true; }
  const { StreetViewPanorama } = await importLibrary("streetView");
  const pano = new StreetViewPanorama(el, {
    position: { lng: start[0], lat: start[1] },
    pov: { heading, pitch: -3 },
    disableDefaultUI: true, clickToGo: false, linksControl: false, showRoadLabels: false,
    motionTracking: false, motionTrackingControl: false, scrollwheel: false, zoom: 0.6,
  });
  const listener = pano.addListener("status_changed", () => onCoverage(pano.getStatus() === "OK"));
  let last: [number, number] = start;
  let lastHop = 0;
  let pov = heading;
  return {
    follow(pos, h) {
      const now = performance.now();
      if (distM(last[0], last[1], pos[0], pos[1]) >= HOP_M && now - lastHop > 350) {
        pano.setPosition({ lng: pos[0], lat: pos[1] });
        last = pos; lastHop = now;
      }
      const d = ((h - pov + 540) % 360) - 180;
      pov += d * 0.12;
      pano.setPov({ heading: pov, pitch: -3 });
    },
    destroy() {
      listener.remove();
      pano.setVisible(false);
      el.replaceChildren();
    },
  };
}
