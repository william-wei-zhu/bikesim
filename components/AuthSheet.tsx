"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Box, Mail, X } from "lucide-react";
import { Btn } from "@/components/ui";
import { sendEmailLink, signInWithGoogle, completeEmailLink, googleSignIn } from "@/lib/auth";
import { track } from "@/lib/analytics";

export type AuthReason = "streetview" | "save" | "account" | "confirm";

const COPY: Record<AuthReason, { title: string; body: string }> = {
  streetview: {
    title: "Keep riding in Street View",
    body: "Your first Street View ride was free. Sign in to keep riding through real street photos. It's free, and 3D rides never need an account.",
  },
  save: { title: "Save this trip", body: "Sign in to keep trips you want to ride again, on any device." },
  account: { title: "Sign in to BikeSim", body: "Ride in Street View and keep your saved trips on any device." },
  confirm: { title: "Finish signing in", body: "Enter the email address the sign-in link was sent to." },
};

/** Sign-in sheet: Google, or a one-time sign-in link by email. Bottom sheet on phones, dialog on desktop. */
export function AuthSheet({ reason, onDone, onClose, onRide3D }: {
  reason: AuthReason; onDone: () => void; onClose: () => void; onRide3D?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const google = async () => {
    setState("busy"); setMsg("");
    try { await signInWithGoogle(); track("signed_in", { method: "google", reason }); onDone(); }
    catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setState("error");
      setMsg(code.includes("popup-closed") || code.includes("cancelled") ? "The Google window was closed before signing in. Try again, or use email."
        : code.includes("popup-blocked") ? "Your browser blocked the Google window. Allow pop-ups for this site, or use email."
        : "Google sign-in isn't available right now. Use the email link instead.");
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setState("error"); setMsg("Enter a full email address, like name@example.com."); return; }
    setState("busy"); setMsg("");
    try {
      if (reason === "confirm") {
        await completeEmailLink(async () => email.trim());
        onDone();
      } else {
        await sendEmailLink(email.trim());
        track("signin_link_sent", { reason });
        setState("sent");
      }
    } catch {
      setState("error");
      setMsg(reason === "confirm" ? "That link has expired or was already used. Ask for a new one." : "The email couldn't be sent. Check the address and try again.");
    }
  };

  const c = COPY[reason];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-line bg-paper p-6 shadow-panel animate-in fade-in slide-in-from-bottom-4 duration-300 md:rounded-card">
        <div className="flex items-start gap-3">
          <h2 id="auth-title" className="flex-1 text-[1.35rem] font-bold leading-tight">{c.title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{c.body}</p>

        {state === "sent" ? (
          <div className="mt-5 rounded-card bg-surface p-4" role="status">
            <p className="flex items-center gap-2 font-semibold"><Mail className="size-4" aria-hidden /> Check your inbox</p>
            <p className="mt-1 text-[0.9rem] text-ink-2">We sent a sign-in link to <span className="font-semibold text-ink">{email}</span>. Open it on this device and you&apos;ll come back to this trip, signed in.</p>
          </div>
        ) : (
          <>
            {reason !== "confirm" && googleSignIn && (
              <Btn ref={first} variant="primary" className="mt-5 w-full" onClick={google} disabled={state === "busy"}>
                <GoogleMark /> Continue with Google
              </Btn>
            )}
            {reason !== "confirm" && googleSignIn && (
              <div className="my-4 flex items-center gap-3 text-[0.8rem] text-ink-2">
                <span className="h-px flex-1 bg-line" /> or get a sign-in link by email <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <form onSubmit={submitEmail} className={reason === "confirm" || !googleSignIn ? "mt-5 space-y-3" : "space-y-3"}>
              <label htmlFor="auth-email" className="sr-only">Email address</label>
              <input id="auth-email" type="email" inputMode="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="min-h-11 w-full rounded-full border-2 border-line bg-paper px-5 text-[0.95rem] outline-none focus:border-accent" />
              <Btn type="submit" variant={googleSignIn ? "outline" : "primary"} className="w-full" disabled={state === "busy"}>
                <Mail className="size-4" aria-hidden /> {reason === "confirm" ? "Sign in" : "Email me a link"}
              </Btn>
            </form>
          </>
        )}
        {state === "error" && <p role="alert" className="mt-3 text-[0.85rem] font-semibold text-[#b42318] dark:text-[#ff8a80]">{msg}</p>}

        {onRide3D && (
          <Btn variant="quiet" className="mt-4 w-full" onClick={onRide3D}>
            <Box className="size-4" aria-hidden /> Ride in 3D instead
          </Btn>
        )}
        <p className="mt-4 text-[0.76rem] leading-relaxed text-ink-2">
          We keep your email and saved trips, nothing else. See <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>.
        </p>
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
