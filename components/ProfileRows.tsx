"use client";

import type { ReactNode } from "react";

/**
 * Profile as rows: a label, its value, and a way in.
 *
 * Three kinds, because there are three things a row can do. One opens its
 * controls in place (`ExpandRow`, which says so with aria-expanded). One goes
 * to another screen that already does the job, the week editor or week setup
 * (`LinkRow`, which does not claim to expand). One is a switch, where the
 * value and the control are the same thing (`SwitchRow`).
 *
 * Every row is at least 56px tall, over the 44px minimum, because these are
 * the targets on a screen people visit rarely and should not have to aim at.
 */

const ROW = "flex min-h-14 w-full items-center justify-between gap-3 px-[18px] py-3 text-left";
const DIVIDED = "border-t border-line first:border-t-0";

export function RowGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <p className="label text-dim">{title}</p>
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-card">{children}</div>
    </section>
  );
}

function Value({ value, turned }: { value: string; turned?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-body text-dim">
      <span className="truncate">{value}</span>
      <span
        aria-hidden
        className={`text-head leading-none text-cyan transition-transform duration-quick ${turned ? "rotate-90" : ""}`}
      >
        ›
      </span>
    </span>
  );
}

export function ExpandRow({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={DIVIDED}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${ROW} transition-colors hover:bg-raise/40`}
      >
        <span className="shrink-0 text-emphasis text-fg">{label}</span>
        <Value value={value} turned={open} />
      </button>
      {open && <div className="px-[18px] pb-[18px]">{children}</div>}
    </div>
  );
}

export function LinkRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <div className={DIVIDED}>
      <button type="button" onClick={onClick} className={`${ROW} transition-colors hover:bg-raise/40`}>
        <span className="shrink-0 text-emphasis text-fg">{label}</span>
        <Value value={value} />
      </button>
    </div>
  );
}

export function SwitchRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={DIVIDED}>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={ROW}>
        <span className="min-w-0">
          <span className="block text-emphasis text-fg">{label}</span>
          {hint && <span className="mt-0.5 block text-caption leading-snug text-dim">{hint}</span>}
        </span>
        <span
          aria-hidden
          className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-quick ${on ? "bg-cyan" : "bg-raise"}`}
        >
          <span
            className={`absolute top-[3px] h-6 w-6 rounded-full bg-ground transition-[left] duration-quick ${on ? "left-[25px]" : "left-[3px]"}`}
          />
        </span>
      </button>
    </div>
  );
}
