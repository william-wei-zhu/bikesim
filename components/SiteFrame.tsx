import Link from "next/link";
import { Header } from "@/components/app/Header";

/** Layout for content pages (About, Privacy, Settings): header, readable column, footer. */
export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-10 md:pt-14">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-5 py-6 text-[0.85rem] text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <span>
            Built by <a className="underline underline-offset-2" href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noreferrer">William Zhu</a>
          </span>
          <span>
            Stress scores from <a className="underline underline-offset-2" href="https://ridescoredc.com" target="_blank" rel="noreferrer">RideScore DC</a> by Civic Tech DC
          </span>
          <Link className="underline underline-offset-2" href="/about">About</Link>
          <Link className="underline underline-offset-2" href="/privacy">Privacy</Link>
          <Link className="underline underline-offset-2" href="/settings">Settings</Link>
        </div>
      </footer>
    </div>
  );
}

/** A content section: heading states the point, body follows. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[1.35rem] font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-[1rem] leading-[1.7]">{children}</div>
    </section>
  );
}
