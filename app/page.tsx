import { MapAppLoader } from "@/components/app/MapAppLoader";

export default function Home() {
  return (
    <main>
      <h1 className="sr-only">RideSim DC: feel it before you ride it.</h1>
      <MapAppLoader />
    </main>
  );
}
