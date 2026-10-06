// Accounts (Firebase Auth + Firestore, GCP project ridesimdc). Loaded lazily so the map never waits for it.
// Sign-in exists for one reason: Street View rides cost real money, so after a device's first free
// Street View ride we ask people to sign in (Google or an emailed link). 3D rides never need an account.
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

export type Account = { uid: string; email: string | null; name: string | null; photo: string | null };

/** Street View rides per signed-in rider per day; the project-wide Google cap is 300 loads a day. */
export const DAILY_STREETVIEW_RIDES = 10;
const FREE_KEY = "bs-sv-free-used";
const EMAIL_KEY = "bs-signin-email";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  projectId: "ridesimdc",
  messagingSenderId: "1001328164035",
  // In production the sign-in handler is served from our own domain (next.config.ts proxies /__/auth),
  // so Google's popup says bikesim.org instead of a firebaseapp.com address.
  authDomain: typeof window !== "undefined" && /(^|\.)bikesim\.org$/.test(window.location.hostname)
    ? window.location.hostname : "ridesimdc.firebaseapp.com",
};

export const authConfigured = Boolean(config.apiKey && config.appId);

let ready: Promise<{ auth: Auth; db: Firestore }> | null = null;
function fb() {
  ready ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
      import("firebase/app"), import("firebase/auth"), import("firebase/firestore"),
    ]);
    const app = getApps()[0] ?? initializeApp(config);
    return { auth: getAuth(app), db: getFirestore(app) };
  })();
  return ready;
}

const toAccount = (u: User | null): Account | null =>
  u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null;

// ---------- who is signed in (shared store for useSyncExternalStore) ----------
let current: Account | null = null;
let known = false;
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started || !authConfigured) return;
  started = true;
  fb().then(async ({ auth }) => {
    const { onAuthStateChanged } = await import("firebase/auth");
    onAuthStateChanged(auth, (u) => {
      current = toAccount(u); known = true;
      listeners.forEach((l) => l());
      if (u) touchProfile(u).catch(() => { /* profile is best effort */ });
    });
    completeEmailLink().catch(() => { /* surfaced by the sign-in sheet when it matters */ });
  }).catch(() => { known = true; listeners.forEach((l) => l()); });
}

export function subscribeAccount(cb: () => void) {
  listeners.add(cb);
  start();
  return () => { listeners.delete(cb); };
}
export const getAccount = () => current;
export const accountKnown = () => known;

// ---------- sign in / out ----------
export async function signInWithGoogle() {
  const { auth } = await fb();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  await signInWithPopup(auth, new GoogleAuthProvider());
}

/** Emails a one-time sign-in link that comes back to this exact page (the trip is in the URL). */
export async function sendEmailLink(email: string) {
  const { auth } = await fb();
  const { sendSignInLinkToEmail } = await import("firebase/auth");
  const url = new URL(window.location.href);
  url.searchParams.set("signin", "1");
  await sendSignInLinkToEmail(auth, email, { url: url.toString(), handleCodeInApp: true });
  try { localStorage.setItem(EMAIL_KEY, email); } catch { /* the link page will ask for the email again */ }
}

/** Finishes an emailed-link sign-in when this page was opened from the link. Returns true if it signed in.
 *  `askEmail` is used when the link is opened on a different device than the one that asked for it. */
let linkAttempt: Promise<boolean> | null = null;
export function completeEmailLink(askEmail?: () => Promise<string | null>): Promise<boolean> {
  // The automatic attempt (stored email) runs once per page; an explicit one (typed email) always runs.
  if (askEmail) return finishEmailLink(askEmail);
  linkAttempt ??= finishEmailLink();
  return linkAttempt;
}

async function finishEmailLink(askEmail?: () => Promise<string | null>): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { auth } = await fb();
  const { isSignInWithEmailLink, signInWithEmailLink } = await import("firebase/auth");
  if (!isSignInWithEmailLink(auth, window.location.href)) return false;
  let email: string | null = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch { /* fall through */ }
  if (!email && askEmail) email = await askEmail();
  if (!email) return false;
  await signInWithEmailLink(auth, email, window.location.href);
  try { localStorage.removeItem(EMAIL_KEY); } catch { /* ignore */ }
  // Drop the one-time code from the address bar, keep the trip.
  const url = new URL(window.location.href);
  for (const k of ["apiKey", "oobCode", "mode", "lang", "signin", "continueUrl"]) url.searchParams.delete(k);
  window.history.replaceState(null, "", url.toString());
  return true;
}

/** True when this page was opened from an emailed sign-in link. */
export const isEmailLinkReturn = () => typeof window !== "undefined" && /[?&]oobCode=/.test(window.location.search);

export async function signOut() {
  const { auth } = await fb();
  const { signOut: out } = await import("firebase/auth");
  await out(auth);
}

/** Deletes the rider's saved trips, profile and account. Google may ask for a fresh sign-in first. */
export async function deleteAccount() {
  const { auth, db } = await fb();
  const u = auth.currentUser;
  if (!u) return;
  const { collection, getDocs, deleteDoc, doc } = await import("firebase/firestore");
  const trips = await getDocs(collection(db, "users", u.uid, "trips"));
  await Promise.all(trips.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "users", u.uid));
  await u.delete();
}

async function touchProfile(u: User) {
  const { db } = await fb();
  const { doc, setDoc, serverTimestamp, getDoc } = await import("firebase/firestore");
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  await setDoc(ref, snap.exists() ? { lastSeen: serverTimestamp() } : { created: serverTimestamp(), lastSeen: serverTimestamp(), email: u.email ?? null }, { merge: true });
}

// ---------- the Street View gate ----------
export function freeStreetViewUsed() {
  try { return localStorage.getItem(FREE_KEY) === "1"; } catch { return false; }
}
export function markFreeStreetViewUsed() {
  try { localStorage.setItem(FREE_KEY, "1"); } catch { /* storage blocked: the gate falls back to per-session */ }
}

/** Counts one Street View ride against today's allowance. Returns false when the rider is over it. */
export async function claimStreetViewRide(): Promise<boolean> {
  const { auth, db } = await fb();
  const u = auth.currentUser;
  if (!u) return false;
  const { doc, runTransaction } = await import("firebase/firestore");
  const today = new Date().toISOString().slice(0, 10);
  const ref = doc(db, "users", u.uid);
  return runTransaction(db, async (tx) => {
    const d = (await tx.get(ref)).data() as { svDay?: string; svCount?: number } | undefined;
    const used = d?.svDay === today ? d.svCount ?? 0 : 0;
    if (used >= DAILY_STREETVIEW_RIDES) return false;
    tx.set(ref, { svDay: today, svCount: used + 1 }, { merge: true });
    return true;
  });
}

// ---------- saved trips ----------
export interface SavedTrip { id: string; city: string; label: string; from: { x: number; y: number; label: string }; to: { x: number; y: number; label: string } }

export async function saveTrip(t: Omit<SavedTrip, "id">) {
  const { auth, db } = await fb();
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in to save trips.");
  const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  await addDoc(collection(db, "users", u.uid, "trips"), { ...t, created: serverTimestamp() });
}

export async function listTrips(): Promise<SavedTrip[]> {
  const { auth, db } = await fb();
  const u = auth.currentUser;
  if (!u) return [];
  const { collection, getDocs, orderBy, query, limit } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(db, "users", u.uid, "trips"), orderBy("created", "desc"), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedTrip, "id">) }));
}

export async function deleteTrip(id: string) {
  const { auth, db } = await fb();
  const u = auth.currentUser;
  if (!u) return;
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, "users", u.uid, "trips", id));
}
