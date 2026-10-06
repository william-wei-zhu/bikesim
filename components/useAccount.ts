"use client";
import { useSyncExternalStore } from "react";
import { subscribeAccount, getAccount, accountKnown, type Account } from "@/lib/auth";

/** The signed-in rider (null when signed out), and whether Firebase has answered yet. */
export function useAccount(): { account: Account | null; known: boolean } {
  const account = useSyncExternalStore(subscribeAccount, getAccount, () => null);
  const known = useSyncExternalStore(subscribeAccount, accountKnown, () => false);
  return { account, known };
}
