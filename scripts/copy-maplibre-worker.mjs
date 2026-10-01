// MapLibre v6 loads its web worker from a URL; bundlers can't resolve it, so we
// serve the worker (and the shared chunk it imports) from public/ and point
// setWorkerUrl() at it. Runs on postinstall so it tracks the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/maplibre-gl/dist/";
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(src + f, "public/maplibre/" + f);
console.log("copied MapLibre worker to public/maplibre/");
