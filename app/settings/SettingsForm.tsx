"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Segmented } from "@/components/ui";
import { DEFAULT_VIEW_KEY, readDefaultView, writeDefaultView, type DefaultView } from "@/lib/prefs";

const noop = () => () => {};

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  // Render controls only on the client (theme and stored prefs are unknown on the server).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const view = useSyncExternalStore(subscribeView, readDefaultView, () => "street" as DefaultView);

  if (!mounted) return <div className="mt-8 h-64" aria-hidden />;
  return (
    <div className="mt-8 space-y-4">
      <Row title="Theme" hint="Follow your device, or pick light or dark.">
        <Segmented label="Theme" value={(theme as "system" | "light" | "dark") ?? "system"} onChange={setTheme}
          options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </Row>
      <Row title="Default ride view" hint="Which view a ride starts in. You can still switch during the ride.">
        <Segmented<DefaultView> label="Default ride view" value={view} onChange={(v) => { writeDefaultView(v); }}
          options={[{ value: "street", label: "Street View" }, { value: "model", label: "3D model" }]} />
      </Row>
    </div>
  );
}

function subscribeView(cb: () => void) {
  const on = (e: StorageEvent) => { if (e.key === DEFAULT_VIEW_KEY || e.key === null) cb(); };
  window.addEventListener("storage", on);
  window.addEventListener("rs-prefs", cb);
  return () => { window.removeEventListener("storage", on); window.removeEventListener("rs-prefs", cb); };
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-[1.15rem] font-bold">{title}</h2>
      <p className="mt-1 text-[0.9rem] text-ink-2">{hint}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
