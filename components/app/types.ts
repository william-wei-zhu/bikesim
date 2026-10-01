import type { Net, Extras, Rider } from "@/lib/engine/net";
import type { Islands } from "@/lib/engine/graph";
import type { Mode } from "@/lib/engine/map";
import type { Place } from "@/components/SearchBox";

export interface AppCtx {
  net: Net;
  extras: Extras | null;
  mode: Mode; setMode: (m: Mode) => void;
  rider: Rider; threshold: number;
  fixed: Set<number>; toggleFix: (e: number) => void; addFixes: (es: number[]) => void; clearFixes: () => void;
  is: Islands;
  selEdge: number | null; setSelEdge: (e: number | null) => void;
  flat: boolean; setFlat: (f: boolean) => void;
  showCrashes: boolean; setShowCrashes: (s: boolean) => void;
  focus: Place | null; setFocus: (p: Place | null) => void; focusNode: number;
  from: Place | null; to: Place | null; setFrom: (p: Place | null) => void; setTo: (p: Place | null) => void;
  pick: "from" | "to" | "focus" | null; setPick: (p: "from" | "to" | "focus" | null) => void;
  flyTo: (x: number, y: number, zoom?: number) => void;
  flyToEdge: (e: number) => void;
  startRide: () => void;
  photorealAvailable: boolean; photoreal: boolean; setPhotoreal: (on: boolean) => void;
  toast: (msg: string) => void;
}

import type { Route } from "@/lib/engine/graph";
export type Routes =
  | null
  | { error: "far" | "same" | "none" }
  | { a: number; b: number; calm: Route; fastest: Route };
