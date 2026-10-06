import type { Metadata } from "next";
import { SiteFrame } from "@/components/SiteFrame";
import { SettingsForm } from "./SettingsForm";
import { AccountSection } from "./AccountSection";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <SiteFrame>
      <h1 className="text-[2rem] font-bold md:text-[2.6rem]">Settings</h1>
      <p className="mt-3 text-[1rem] text-ink-2">Theme, ride view and rider are saved on this device. Saved trips live in your account.</p>
      <SettingsForm />
      <AccountSection />
    </SiteFrame>
  );
}
