"use client";

import { useState } from "react";
import Chart from "./Chart";
import Stepper from "./Stepper";
import { Card, Pill } from "./ui";
import type { WeighIn } from "@/lib/types";

/**
 * Body weight over time.
 *
 * Kept on Progress rather than anywhere near logging. Weighing yourself is not
 * part of a set, and putting a scale reading in the middle of a workout is how
 * a training app starts feeling like a diet app — which is the one thing the
 * research said this audience had already quit.
 *
 * There is no goal weight, no target line and no "to go" number, on purpose.
 * The product's whole argument is that showing up is the thing being measured;
 * a body-weight target is a number you can fail at daily, and this is not the
 * app that does that. It draws the line and says nothing about it.
 */
export default function BodyWeight({
  weighIns,
  today,
  onSave,
}: {
  weighIns: WeighIn[];
  /** ISO date, so "today" agrees with the rest of the app's local-date rule. */
  today: string;
  onSave: (lb: number) => void;
}) {
  const latest = weighIns[weighIns.length - 1];
  const loggedToday = weighIns.some((w) => w.date === today);
  const [open, setOpen] = useState(false);
  /*
    Opens on the last reading, because the next one is nearly always within a
    pound or two of it — that makes the steppers a two-tap job instead of a
    hundred. With no history there is no informed guess to make, so it starts
    at a round 150 and expects to be typed over; the value is tappable.
  */
  const [draft, setDraft] = useState(() => latest?.lb ?? 150);

  function commit() {
    onSave(draft);
    setOpen(false);
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <p className="label text-dim">Body weight</p>
        {weighIns.length > 0 && !open && (
          <button
            type="button"
            onClick={() => {
              setDraft(latest?.lb ?? 150);
              setOpen(true);
            }}
            className="head tap text-body text-cyan transition-opacity hover:opacity-70"
          >
            {loggedToday ? "Update" : "Add today"}
          </button>
        )}
      </div>

      <Card className="mt-3 p-[18px]">
        {weighIns.length === 0 && !open ? (
          <>
            <p className="text-body text-dim">
              Weigh in whenever you feel like it. Nothing here counts against you.
            </p>
            <div className="mt-4">
              <Pill size="sm" variant="ghost" onClick={() => setOpen(true)}>
                Add a weigh-in
              </Pill>
            </div>
          </>
        ) : (
          <>
            {latest && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular statement text-figure text-fg">{latest.lb}</span>
                <span className="text-body text-dim">
                  lb ·{" "}
                  {new Date(latest.date + "T00:00:00").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
            {weighIns.length > 0 && (
              <div className="mt-3">
                <Chart
                  points={weighIns.map((w) => ({ date: w.date, value: w.lb }))}
                  label="Body weight"
                />
              </div>
            )}
          </>
        )}

        {open && (
          <div className="mt-4 border-t border-line pt-4">
            <Stepper
              label="Weight"
              value={draft}
              // Half-pound steps: the increment a bathroom scale actually
              // reports, and the one the logging screen already uses for load.
              step={0.5}
              min={40}
              max={700}
              suffix="lb"
              onChange={setDraft}
            />
            <div className="mt-4 flex gap-2.5">
              <Pill size="sm" onClick={commit}>
                {loggedToday ? "Update today" : "Save"}
              </Pill>
              <Pill size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Pill>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
