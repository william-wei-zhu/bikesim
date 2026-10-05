import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapAppLoader } from "@/components/app/MapAppLoader";
import { getCity, LIVE_CITIES } from "@/lib/cities";

// Only cities with built street data get a page; any other slug is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return LIVE_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[city]">): Promise<Metadata> {
  const city = getCity((await params).city);
  if (!city) return {};
  return {
    title: { absolute: `BikeSim ${city.short}: feel it before you ride it` },
    description: `See how stressful every block of a ${city.name} bike trip will be, then ride it virtually before you go.`,
    alternates: { canonical: `/${city.slug}` },
  };
}

export default async function CityPage({ params }: PageProps<"/[city]">) {
  const city = getCity((await params).city);
  if (!city?.live) notFound();
  return (
    <main>
      <h1 className="sr-only">BikeSim {city.name}: feel it before you ride it.</h1>
      <MapAppLoader slug={city.slug} />
    </main>
  );
}
