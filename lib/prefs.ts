// Per-device preferences in localStorage. Every access is guarded: storage can be blocked or unavailable.
export type DefaultView = "street" | "model";
export const DEFAULT_VIEW_KEY = "rs-default-view";

export function readDefaultView(): DefaultView {
  try {
    return window.localStorage.getItem(DEFAULT_VIEW_KEY) === "model" ? "model" : "street";
  } catch {
    return "street";
  }
}

export function writeDefaultView(v: DefaultView) {
  try { window.localStorage.setItem(DEFAULT_VIEW_KEY, v); } catch { /* storage blocked: keep the in-session choice only */ }
  window.dispatchEvent(new Event("rs-prefs"));
}
