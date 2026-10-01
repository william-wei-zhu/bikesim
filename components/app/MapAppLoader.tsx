"use client";
import dynamic from "next/dynamic";

// The map needs WebGL and window; render it only in the browser.
export const MapAppLoader = dynamic(() => import("./MapApp"), { ssr: false });
