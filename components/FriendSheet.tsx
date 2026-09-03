"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pill } from "./ui";
import { nameOf } from "@/lib/exercises";
import type { CrewMember, SharedDay } from "@/lib/cloud";

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * One person in the crew, opened.
 *
 * What is here is everything the server knows about them, which is not much on
 * purpose: the days they trained, and a plan if they chose to publish one.
 * There is no weight, no rep count, no session history and no total, because
 * none of that is stored — the schema has no column for it, so this screen
 * cannot become the leaderboard the 2023 flow had even by accident.
 *
 * The plan is the one thing worth copying. Which lifts somebody does is
 * programming; how much they lift is performance, and the difference is the
 * whole argument. Copying gives you their selection and your own engine's
 * loads, which is the only honest way to hand a beginner someone else's week.
 */
export default function FriendSheet({
  member,
  onClose,
  onCopy,
  framed = false,
}: {
  member: CrewMember;
  onClose: () => void;
  /** Take this day somewhere it can be put into her own week. */
  onCopy: (day: SharedDay, from: string) => void;
  framed?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<"month" | "all">("month");

  useEffect(() => {
    if (framed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    const behind = document.getElementById("app-scroll");
    behind?.setAttribute("inert", "");
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      behind?.removeAttribute("inert");
      document.body.style.overflow = prior;
    };
  }, [onClose, framed]);

  // Six weeks back, the same lattice Progress uses, so a crew mate's rhythm
  // reads the way her own does.
  const today = new Date();
  const weeks = range === "month" ? 6 : 12;
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const trained = new Set(member.days);
  const grid = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + d);
      return { iso: iso(cell), future: cell > today };
    })
  );
  const total = member.days.length;

  const sheetEl = (
    <div
      role="dialog"
      aria-modal={framed ? undefined : "true"}
      aria-label={member.name}
      ref={sheet}
      tabIndex={-1}
      className={`z-50 flex justify-center bg-ground/95 outline-none ${
        framed ? "absolute inset-0" : "fixed inset-0 desk:absolute"
      }`}
    >
      <div className="no-scrollbar flex w-full max-w-[430px] flex-col overflow-y-auto px-6 pb-8 pt-12">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label text-cyan">In your crew</p>
            <h1 className="statement mt-1.5 text-[40px] leading-none text-fg">{member.name}</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="head -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[17px] text-dim transition-colors hover:bg-raise hover:text-fg"
          >
            ✕
          </button>
        </div>

        {/*
          Days, drawn as absence and presence. No count of anything they lifted,
          because none of it is stored — and a missed day is left as bare
          substrate rather than marked, exactly as it is on her own Progress.
        */}
        <section className="mt-6 rounded-2xl bg-card p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-dim">When they train</p>
            <button
              type="button"
              onClick={() => setRange(range === "month" ? "all" : "month")}
              className="head tap shrink-0 text-[15px] text-cyan transition-opacity hover:opacity-70"
            >
              {range === "month" ? "12 weeks" : "6 weeks"}
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-1" aria-hidden>
            {grid.map((week, i) => (
              <div key={i} className="flex gap-1">
                {week.map((c) => (
                  <span
                    key={c.iso}
                    className={`h-3 flex-1 rounded-[4px] ${
                      trained.has(c.iso) ? "bg-green" : c.future ? "bg-transparent" : "bg-raise"
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[15px] text-dim">
            {total === 0
              ? "Nothing logged yet."
              : `${total} ${total === 1 ? "session" : "sessions"} since they joined.`}
          </p>
        </section>

        {member.plan?.length ? (
          <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
            <p className="label text-dim">What they do</p>
            <ul className="mt-3 flex flex-col gap-4">
              {member.plan.map((d) => (
                <li key={`${d.day}-${d.label}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="head text-[17px] text-fg">
                      {d.label}
                      <span className="text-dim"> · {FULL[d.day]}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[15px] leading-snug text-dim">
                    {d.exercises.map((e) => nameOf(e)).join(", ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => onCopy(d, member.name)}
                    className="head tap mt-2 text-[15px] text-cyan transition-opacity hover:opacity-70"
                  >
                    Copy this workout →
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3.5 text-[15px] leading-snug text-dim">
              Their lifts, your weights. What you can lift is yours and is not part of
              this.
            </p>
          </section>
        ) : (
          <section className="mt-2.5 rounded-2xl bg-card p-[18px]">
            <p className="label text-dim">What they do</p>
            <p className="mt-2 text-[17px] leading-snug text-fg">
              {member.mine
                ? "You have not shared your week yet."
                : `${member.name} has not shared their week.`}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-dim">
              Sharing a week shows which lifts are in it. Never any weights.
            </p>
          </section>
        )}

        <div className="mt-auto pt-8">
          <Pill variant="ghost" onClick={onClose}>
            Back to the crew
          </Pill>
        </div>
      </div>
    </div>
  );

  if (framed) return sheetEl;
  const host = typeof document === "undefined" ? null : document.getElementById("device");
  return host ? createPortal(sheetEl, host) : sheetEl;
}
