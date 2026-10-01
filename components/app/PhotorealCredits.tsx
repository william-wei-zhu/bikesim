"use client";
/* eslint-disable @next/next/no-img-element -- Google's hosted logo asset, required attribution for Photorealistic 3D Tiles */

/** Google logo + aggregated data credits, required while Photorealistic 3D Tiles are on screen. */
export function PhotorealCredits({ credits }: { credits: string }) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full bg-[#082b54]/80 px-3 py-1 text-[0.62rem] text-white md:bottom-3">
      <img src="https://maps.gstatic.com/mapfiles/api-3/images/google_white5_hdpi.png" alt="Google" width={52} height={16} className="h-4 w-auto" />
      <span className="truncate">{credits || "Loading imagery…"}</span>
    </div>
  );
}
