"use client";
import { useEffect } from "react";
import { startAnalytics, identify } from "@/lib/analytics";
import { useAccount } from "@/components/useAccount";

/** Starts PostHog once per page load and keeps it in step with sign-in. */
export function Analytics() {
  const { account, known } = useAccount();
  useEffect(() => { startAnalytics(); }, []);
  useEffect(() => { if (known) identify(account?.uid ?? null); }, [account, known]);
  return null;
}
