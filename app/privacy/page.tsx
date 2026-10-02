import type { Metadata } from "next";
import { SiteFrame, Section } from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "Privacy",
  description: "RideSim DC has no accounts and stores no personal data. What is sent where, and what the site is not.",
};

export default function PrivacyPage() {
  return (
    <SiteFrame>
      <h1 className="text-[2rem] font-bold md:text-[2.6rem]">No accounts, no personal data stored.</h1>
      <p className="mt-4 text-[1.1rem] leading-[1.7]">
        RideSim DC does not ask who you are and does not keep a record of the trips you plan.
      </p>

      <Section title="Your trip stays in your browser">
        <p>
          The start and destination you pick live in the page address, so you can share a trip by copying the link.
          Route planning runs entirely in your browser; your trip is not sent to our server.
        </p>
        <p>Your theme and default ride view are saved in your browser&apos;s local storage, on your device only.</p>
      </Section>

      <Section title="Some services see your request">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold">Address search:</span> what you type is sent through our server to OpenStreetMap Nominatim to find the place.
            We keep results in short-lived memory to answer repeat searches faster, and we count requests per network address only to prevent abuse. Nothing is written to a database.
          </li>
          <li>
            <span className="font-semibold">Street View:</span> during a Street View ride, your browser loads photos directly from Google, under Google&apos;s privacy policy.
          </li>
          <li>
            <span className="font-semibold">Map tiles:</span> the map and buildings load from OpenFreeMap.
          </li>
          <li>
            <span className="font-semibold">Hosting:</span> the site runs on Vercel, which keeps standard server logs.
          </li>
        </ul>
      </Section>

      <Section title="Informational only">
        <p>
          RideSim DC is an informational planning tool, not safety, legal or professional advice. Stress scores are estimates from public data
          and can be wrong or out of date. Street conditions change. Verify conditions yourself and ride with care.
        </p>
      </Section>
    </SiteFrame>
  );
}
