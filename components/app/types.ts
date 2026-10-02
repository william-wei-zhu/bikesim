import type { Route } from "@/lib/engine/graph";

/** How the ride is shown: our 3D model, or Google Street View photos. */
export type View = "model" | "street";

export type Routes =
  | null
  | { error: "far" | "same" | "none" }
  | { a: number; b: number; calm: Route; fastest: Route };

/** Which route to ride: the shortest one (default) or the lowest-stress one (avoids hostile streets). */
export type RouteKind = "calm" | "short";
