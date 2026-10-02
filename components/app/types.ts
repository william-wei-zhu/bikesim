import type { Route } from "@/lib/engine/graph";

/** How the ride is shown: our 3D model, or Google Street View photos. */
export type View = "model" | "street";

export type Routes =
  | null
  | { error: "far" | "same" | "none" }
  | { a: number; b: number; calm: Route; fastest: Route };
