import Link from "next/link";
import type { ReactNode } from "react";
type ContentProps = { children?: ReactNode };
type TitleProps = ContentProps & { title: string };
export const control =
  "workspace-control min-h-11 w-full min-w-0 rounded-lg border border-board-line bg-board-tag px-3 py-2 text-base text-board-text placeholder:text-board-muted";
export const primary =
  "workspace-primary inline-flex min-h-11 items-center justify-center rounded-lg bg-board-accent px-4 py-2 text-sm font-bold text-board-ink hover:bg-board-accent-hover disabled:opacity-50 disabled:cursor-not-allowed";
export const secondary =
  "workspace-secondary inline-flex min-h-11 items-center justify-center rounded-lg border border-board-line bg-board-tag px-4 py-2 text-sm font-semibold hover:border-board-accent disabled:opacity-50";
export function Field({ label, children }: ContentProps & { label: string }) {
  return (
    <label className="block text-sm text-board-muted">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
export function Heading({ title, children }: TitleProps) {
  return (
    <div className="workspace-heading mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children && (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-board-muted">
          {children}
        </p>
      )}
    </div>
  );
}
export function Section({ title, children }: TitleProps) {
  return (
    <section className="workspace-section mt-8 border-t border-board-line pt-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
export function Notice({ children }: ContentProps) {
  return (
    <p role="status" className="mt-3 text-sm leading-relaxed text-board-muted">
      {children}
    </p>
  );
}
export function Empty({ title, children, href, action }: TitleProps & { href?: string; action?: string }) {
  return (
    <div className="glass-panel rounded-2xl border border-board-line bg-board-panel px-5 py-10 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-board-muted">
        {children}
      </p>
      {href && (
        <Link className={`${primary} mt-5`} href={href}>
          {action}
        </Link>
      )}
    </div>
  );
}
