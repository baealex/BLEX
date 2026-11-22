import { SiteIcon } from '../../../appearance/icons.js';
import type { ReactNode } from 'react';

export const authField = 'block text-xs font-semibold tracking-wide text-content-secondary';
export const authInput = 'mt-1.5 w-full rounded-lg border border-line bg-surface/40 px-4 py-3.5 text-sm font-medium text-content outline-none transition-all duration-200 placeholder:text-content-hint focus:border-line-strong focus:ring-4 focus:ring-line/25';
export const authSubmit = 'flex w-full items-center justify-center rounded-lg bg-action px-6 py-3.5 text-sm font-semibold text-content-inverted shadow-floating transition-all duration-200 hover:-translate-y-0.5 hover:bg-action-hover active:translate-y-0 disabled:opacity-50';

export function AuthPanel({ title, description, id, lock, children }: {
  title: string; description?: string; id: string; lock?: boolean; children: ReactNode;
}) {
  return <section className="w-[420px] max-w-[90vw]" aria-labelledby={id}>
    <header className="mb-8 text-center">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-action text-content-inverted shadow-floating ring-1 ring-line/20">
        <SiteIcon name={lock ? 'lock' : 'book'} className="size-8" />
      </div>
      <h1 id={id} className="mb-3 text-3xl font-bold tracking-tight text-content">{title}</h1>
      {description && <p className="text-sm font-medium text-content-secondary">{description}</p>}
    </header>
    <div className="relative overflow-hidden rounded-[2rem] border border-line/40 bg-surface/60 p-8 shadow-elevated backdrop-blur-2xl md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-surface/40 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  </section>;
}
