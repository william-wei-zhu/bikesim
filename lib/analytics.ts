// Product analytics (PostHog). No-op until NEXT_PUBLIC_POSTHOG_KEY is set. Events go through /ingest on our
// own domain (next.config.ts rewrites), so ad blockers don't silently drop them. No session recordings.
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let started = false;

export function startAnalytics() {
  if (started || !KEY || typeof window === "undefined") return;
  started = true;
  posthog.init(KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: "history_change",
    person_profiles: "identified_only",
    disable_session_recording: true,
  });
}

/** One product event: what the rider did, with the city and the few numbers that explain it. */
export function track(event: string, props?: Record<string, string | number | boolean | null>) {
  if (started) posthog.capture(event, props);
}

/** Tie events to a signed-in account (by id only, never the email). */
export function identify(uid: string | null) {
  if (!started) return;
  if (uid) posthog.identify(uid); else posthog.reset();
}
