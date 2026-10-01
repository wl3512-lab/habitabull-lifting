"use client";

import { useId, type ReactNode } from "react";

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

// The ring is drawn inward because the rows run edge to edge inside a card that
// clips its overflow, so the global 2px outset ring would be cut off. The offset
// is important-flagged on purpose: the global focus rule is unlayered, and an
// unlayered declaration beats a layered utility whatever its specificity, so
// without the "!" this would silently do nothing. Do not remove it as redundant.
const ROW =
  "flex min-h-14 w-full items-center justify-between gap-3 px-[18px] py-3 text-left transition-colors hover:bg-raise/40 focus-visible:-outline-offset-2!";
const DIVIDED = "border-t border-line first:border-t-0";

export function RowGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="label text-dim">
        {title}
      </h2>
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
        className={ROW}
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
      <button type="button" onClick={onClick} className={ROW}>
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
  // The hint is a description, not part of the name, so a screen reader says
  // "Reminders, switch, on" and then the hint, not one long label.
  // Track is 52x30 with a 2px border, so its padding box is 48x26. The 20px knob
  // sits 3px from the top, bottom and left edge, and slides 22px to sit 3px from
  // the right. The border is always present, transparent when on, so nothing shifts.
  const labelId = useId();
  const hintId = useId();
  return (
    <div className={DIVIDED}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => onChange(!on)}
        className={ROW}
      >
        <span className="min-w-0">
          <span id={labelId} className="block text-emphasis text-fg">
            {label}
          </span>
          {hint && (
            <span id={hintId} className="mt-0.5 block text-caption leading-snug text-dim">
              {hint}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className={`relative h-[30px] w-[52px] shrink-0 rounded-full border-2 transition-colors duration-quick ${on ? "border-transparent bg-cyan" : "border-line-strong bg-raise"}`}
        >
          <span
            className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-ground transition-transform duration-quick ${on ? "translate-x-[22px]" : "translate-x-0"}`}
          />
        </span>
      </button>
    </div>
  );
}
