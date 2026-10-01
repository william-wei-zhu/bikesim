import { MapAppLoader } from "@/components/app/MapAppLoader";

export default function Home() {
  return (
    <main>
      <h1 className="sr-only">RideSim DC: break the walls, ride the city.</h1>
      <MapAppLoader />
    </main>
  );
}
