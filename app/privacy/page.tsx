import type { Metadata } from "next";
import { SiteFrame, Section } from "@/components/SiteFrame";
import { DAILY_STREETVIEW_RIDES } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What BikeSim stores (only your email and saved trips, if you sign in), what is sent where, and what the site is not.",
};

export default function PrivacyPage() {
  return (
    <SiteFrame>
      <h1 className="text-[2rem] font-bold md:text-[2.6rem]">Your email and saved trips, nothing else.</h1>
      <p className="mt-4 text-[1.1rem] leading-[1.7]">
        You can plan and ride trips without an account. If you sign in, BikeSim keeps your email address, the trips you choose to save,
        and a count of today&apos;s Street View rides. That&apos;s all.
      </p>

      <Section title="Your trip stays in your browser">
        <p>
          The start and destination you pick live in the page address, so you can share a trip by copying the link.
          Route planning runs entirely in your browser; your trip is not sent to our server unless you press Save.
        </p>
        <p>Your theme, default ride view and rider choice are saved in your browser&apos;s local storage, on your device only.</p>
      </Section>

      <Section title="If you sign in">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Sign-in runs on Google Firebase Authentication, with Google or a one-time link sent to your email. We never see a password.</li>
          <li>
            We store your email, when you joined and last visited, trips you save, and how many Street View rides you took today
            (Street View costs us money per ride, so signed-in riders get {DAILY_STREETVIEW_RIDES} a day). This lives in Google Cloud Firestore.
          </li>
          <li>Each device gets one Street View ride before we ask you to sign in; that is remembered in your browser&apos;s local storage, not on our servers.</li>
          <li>Delete your account in Settings at any time: your saved trips and profile are deleted with it.</li>
          <li>We don&apos;t sell or share your data, send marketing email, or use ad trackers.</li>
        </ul>
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
            <span className="font-semibold">Map tiles and street data:</span> the map and buildings load from OpenFreeMap; street stress data and aerial photos load from our Google Cloud Storage bucket and USGS (DC photos from DC government).
          </li>
          <li>
            <span className="font-semibold">Hosting:</span> the site runs on Vercel, which keeps standard server logs.
          </li>
        </ul>
      </Section>

      <Section title="Informational only">
        <p>
          BikeSim is an informational planning tool, not safety, legal or professional advice. Stress scores are estimates from public data
          and can be wrong or out of date. Street conditions change. Verify conditions yourself and ride with care.
        </p>
      </Section>
    </SiteFrame>
  );
}
