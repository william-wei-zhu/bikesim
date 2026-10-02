// Small UI primitives in the RideSim style: every action looks clickable at rest.
import Link from "next/link";
import { cn } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "quiet"; size?: "md" | "sm" };

export function Btn({ variant = "outline", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none",
        size === "md" ? "min-h-11 px-5 text-[0.85rem]" : "min-h-9 px-4 text-[0.8rem]",
        variant === "primary" && "bg-primary text-primary-ink hover:opacity-90",
        variant === "outline" && "border-2 border-ink bg-paper text-ink hover:bg-surface",
        variant === "quiet" && "border border-line bg-surface text-ink hover:border-ink",
        className,
      )}
    />
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, className, stretch }: {
  value: T; options: { value: T; label: string; title?: string; sub?: string }[]; onChange: (v: T) => void; label: string; className?: string;
  /** Fill the container width with equal-width options. */
  stretch?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("rounded-full border border-line bg-surface p-1", stretch ? "flex w-full" : "inline-flex", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded-full px-3.5 text-[0.8rem] font-semibold transition-colors cursor-pointer whitespace-nowrap",
            stretch && "min-w-0 flex-1 px-1.5",
            o.sub && "flex min-h-12 flex-col items-center justify-center leading-tight",
            value === o.value ? "bg-primary text-primary-ink shadow-sm" : "text-ink hover:bg-paper",
          )}
        >
          {o.label}
          {o.sub && <span className="mt-0.5 font-mono text-[0.76rem] font-medium opacity-80">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-card border border-line bg-surface p-4", className)} />;
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[1.5rem] font-bold leading-tight">{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}

export function TextLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "underline underline-offset-4 decoration-2 decoration-accent hover:decoration-ink";
  return external ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a> : <Link href={href} className={cls}>{children}</Link>;
}

export function LtsChip({ lts, label }: { lts: number; label?: string }) {
  const bg = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"][lts];
  const fg = lts === 2 || lts === 3 ? "text-[#082b54]" : "text-white";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[0.76rem] font-bold", bg, fg)}>
      LTS {lts}{label ? ` · ${label}` : ""}
    </span>
  );
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
