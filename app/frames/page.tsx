"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import AfterWorkout from "@/components/AfterWorkout";
import Calendar from "@/components/Calendar";
import Crew from "@/components/Crew";
import DayDetail from "@/components/DayDetail";
import ExerciseInfo from "@/components/ExerciseInfo";
import Finished from "@/components/Finished";
import GoalScreen from "@/components/GoalScreen";
import LogSession from "@/components/LogSession";
import Onboarding from "@/components/Onboarding";
import Progress from "@/components/Progress";
import RestTimer from "@/components/RestTimer";
import RoutineEditor from "@/components/RoutineEditor";
import TabBar from "@/components/TabBar";
import Today from "@/components/Today";
import YourData from "@/components/YourData";
import WeekSetup from "@/components/WeekSetup";
import { challengeFor } from "@/lib/crew";
import type { Challenge } from "@/lib/types";
import * as f from "./fixtures";

/**
 * Every screen at once, on one page, with no flow to walk through.
 *
 * These are the real components rendered against stand-in data, not exported
 * images — so the gallery cannot drift out of date the way a folder of
 * screenshots does. Each frame is clipped to 390 × 844, which is the artboard
 * and the only size the app is designed at.
 *
 * `?shot=<n>` renders exactly one frame, bare, filling the viewport — no
 * caption, no rounded device, no gallery around it. That is how the stills in
 * redesign-screens/ are produced (see scripts/shoot.mjs), so a still is the
 * same render as the gallery rather than a photograph of it that ages badly.
 *
 * `&scroll=<px>` scrolls that frame before it is captured. A phone screen is
 * often taller than 844, and a still that can only ever show the top of one
 * leaves the bottom half of the app undocumented.
 */

/** The frame being captured and how far down, or null when the gallery shows. */
const Shot = createContext<{ n: string; scroll: number } | null>(null);

const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

function Frame({
  n,
  name,
  note,
  tab,
  children,
}: {
  n: string;
  name: string;
  note: string;
  /** Screens that sit at the top level carry the bar; modes do not. */
  tab?: "today" | "calendar" | "progress" | "crew";
  children: ReactNode;
}) {
  const shot = useContext(Shot);

  // Capture mode: this frame alone, square-cornered, filling the viewport, so
  // the file is the screen and not a picture of a phone on a page.
  if (shot !== null) {
    if (shot.n !== n) return null;
    return <Captured n={n} scroll={shot.scroll} tab={tab}>{children}</Captured>;
  }

  return (
    <figure className="flex w-[390px] shrink-0 flex-col">
      <figcaption className="mb-2.5">
        <p className="label text-cyan">
          {n} · {name}
        </p>
        <p className="mt-1 text-[14px] leading-snug text-dim">{note}</p>
      </figcaption>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[28px] bg-ground shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-16px_rgb(0_0_0/0.6)]">
        <div className="flex h-full w-full flex-col overflow-y-auto no-scrollbar">
          {children}
          {tab && <TabBar active={tab} onChange={f.noop} />}
        </div>
      </div>
    </figure>
  );
}

/** One frame, alone, scrolled to wherever the capture asked for. */
function Captured({
  n,
  scroll,
  tab,
  children,
}: {
  n: string;
  scroll: number;
  tab?: "today" | "calendar" | "progress" | "crew";
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(scroll === 0);

  useEffect(() => {
    if (!box.current || scroll === 0) return;
    box.current.scrollTop = scroll;
    // The capture waits on data-ready, so a screenshot can never land between
    // the render and the scroll.
    requestAnimationFrame(() => setSettled(true));
  }, [scroll]);

  return (
    <div
      data-shot={n}
      data-ready={settled ? "yes" : "no"}
      className="flex h-[844px] w-[390px] flex-col overflow-hidden bg-ground"
    >
      <div ref={box} className="flex h-full w-full flex-col overflow-y-auto no-scrollbar">
        {children}
        {tab && <TabBar active={tab} onChange={f.noop} />}
      </div>
    </div>
  );
}

function NotBuilt({ n, name, why }: { n: string; name: string; why: string }) {
  if (useContext(Shot) !== null) return null;
  return (
    <figure className="flex w-[390px] shrink-0 flex-col">
      <figcaption className="mb-2.5">
        <p className="label text-dim">
          {n} · {name}
        </p>
        <p className="mt-1 text-[14px] leading-snug text-dim">{why}</p>
      </figcaption>
      <div className="grid h-[844px] w-[390px] place-items-center rounded-[28px] border border-dashed border-line-strong">
        <p className="statement px-10 text-center text-[26px] text-dim">Not built</p>
      </div>
    </figure>
  );
}

function Group({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  // In capture mode the group is only a container; at most one child renders.
  if (useContext(Shot) !== null) return <>{children}</>;
  return (
    <section className="mt-14 first:mt-0">
      <h2 className="statement text-[34px] text-fg">{title}</h2>
      <p className="mt-1 text-[17px] text-dim">{sub}</p>
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-12">{children}</div>
    </section>
  );
}

/**
 * Every frame, declared once. The gallery and the still-capture route render
 * the same call, so a screenshot can never show a screen the gallery does not.
 */
function gallery(challenge: Challenge) {
  return (
    <>
          <Group title="Setup" sub="Two screens, then you lift.">
            <Frame n="00" name="Welcome" note="The 2023 cyan field, kept for exactly one screen. Dark-on-cyan is 8:1; the original white wordmark was 2.23:1.">
              <Onboarding onDone={f.noop} />
            </Frame>
            <Frame n="02" name="Why do you lift?" note="Deck p9 — I Am Sober asks why. Every suggestion is intrinsic on purpose; proposing the extrinsic frame would defeat the finding it came from.">
              <Onboarding onDone={f.noop} initialStep={1} />
            </Frame>
            <Frame n="03" name="Your week" note="After the first session, never before. Anchors rather than clock times — 106 days to form a habit against 154.">
              <WeekSetup profile={f.profile} onSave={f.noop} onSkip={f.noop} />
            </Frame>
          </Group>

          <Group title="The loop" sub="One action per screen, in the same place every time.">
            <Frame n="01" name="Today" tab="today" note="“Full body A”, not “Monday”. A weekday is not a description of a workout.">
              <Today
                profile={f.profile}
                routine={f.routines[0]}
                sessions={f.sessions}
                today={today}
                goal={f.goal}
                onStart={f.noop}
                onConstraints={f.noop}
                onExercise={f.noop}
                onProfile={f.noop}
                onSetUpWeek={f.noop}
                onEditRoutine={f.noop}
                onGoal={f.noop}
                onOpenDay={f.noop}
              />
            </Frame>
            <Frame n="04" name="Logging" note="56px steppers, one orange button, finished sets as a bar you can tap to correct.">
              <LogSession
                session={f.draft}
                history={f.sessions}
                onChange={f.noop}
                onFinish={f.noop}
                onExit={f.noop}
                onExercise={f.noop}
              />
            </Frame>
            <Frame n="05" name="Rest" note="The 45 lb plate from the 2023 app icon, doing a job. It never nags and never advances on its own.">
              <RestTimer
                seconds={120}
                nextExerciseId="deadlift"
                nextWeight={185}
                nextReps={5}
                onDone={f.noop}
                onEnd={f.noop}
              />
            </Frame>
            <Frame n="06" name="Personal record" note="The whole app inverts to orange. No confetti and no badge — the inversion is the celebration.">
              <Finished
                session={{
                  ...f.lastSession,
                  exercises: [
                    { exerciseId: "back-squat", sets: [{ weight: 150, reps: 6, done: true }] },
                  ],
                }}
                sessions={f.sessions}
                records={["back-squat"]}
                onHome={f.noop}
                offerGoal={false}
                onSetGoal={f.noop}
                onAddDetail={f.noop}
              />
            </Frame>
            <Frame n="09" name="Bull coach" note="The one screen where the mascot does literal work: he speaks the cue rather than standing next to it.">
              <ExerciseInfo
                exerciseId="back-squat"
                profile={f.profile}
                onProfile={f.noop}
                onBack={f.noop}
              />
            </Frame>
          </Group>

          <Group title="Coming back" sub="The part every other app skips.">
            <Frame n="01d" name="After a gap" tab="today" note="Her own words move above the primary action, and gain one line: “Still true. The gap does not undo it.”">
              <Today
                profile={f.profile}
                routine={f.routines[0]}
                sessions={f.lapsedSessions}
                today={today}
                goal={null}
                onStart={f.noop}
                onConstraints={f.noop}
                onExercise={f.noop}
                onProfile={f.noop}
                onSetUpWeek={f.noop}
                onEditRoutine={f.noop}
                onGoal={f.noop}
                onOpenDay={f.noop}
              />
            </Frame>
            <Frame n="01c" name="Learned" tab="today" note="Behaviour beats intention. She says “after work”; the timestamps say otherwise, so it offers the correction.">
              <Today
                profile={f.driftProfile}
                routine={f.routines[0]}
                sessions={f.sessions}
                today={today}
                goal={null}
                onStart={f.noop}
                onConstraints={f.noop}
                onExercise={f.noop}
                onProfile={f.noop}
                onSetUpWeek={f.noop}
                onEditRoutine={f.noop}
                onGoal={f.noop}
                onOpenDay={f.noop}
              />
            </Frame>
            <Frame n="01e" name="Today · with a crew" tab="today" note="The whole social layer, one line, on the screen the app opens to. A reply nobody finds is a reply nobody got. Renders nothing when there is nothing to say.">
              <Today
                profile={f.profile}
                routine={f.routines[0]}
                sessions={f.sessions}
                today={f.lastSession.date}
                goal={f.goal}
                crewPreview={f.crewDay}
                onStart={f.noop}
                onConstraints={f.noop}
                onExercise={f.noop}
                onProfile={f.noop}
                onSetUpWeek={f.noop}
                onEditRoutine={f.noop}
                onGoal={f.noop}
                onOpenDay={f.noop}
              />
            </Frame>
            <Frame n="01f" name="Today · reason skipped" tab="today" note="The why is skippable, and skipping it used to leave the screen with nothing personal on it and no way back — the editor lived inside a card that did not render. It invites rather than requires: the reason only works if it is hers.">
              <Today
                profile={f.noReasonProfile}
                routine={f.routines[0]}
                sessions={[]}
                today={f.lastSession.date}
                goal={null}
                onStart={f.noop}
                onConstraints={f.noop}
                onExercise={f.noop}
                onProfile={f.noop}
                onSetUpWeek={f.noop}
                onEditRoutine={f.noop}
                onGoal={f.noop}
                onOpenDay={f.noop}
              />
            </Frame>
            <Frame n="16" name="After the workout" note="Optional and one tap away. The celebration is never gated behind a form.">
              <AfterWorkout
                session={{ ...f.lastSession, note: "Felt strong. Go up 5 lb next time." }}
                records={["back-squat"]}
                onSave={f.noop}
                onSkip={f.noop}
              />
            </Frame>
          </Group>

          <Group title="The record" sub="Progress you can see, without a score attached to it.">
            <Frame n="08" name="Progress" tab="progress" note="Missed days drawn as absence, never as a red mark. Comebacks get their own colour and their own counter.">
              <Progress
                sessions={f.sessions}
                goal={f.goal}
                onGoal={f.noop}
                state={f.state}
                onImport={f.noop}
              />
            </Frame>
            <Frame n="11" name="Calendar" tab="calendar" note="Weeks, not days. The Figma's “you're on fire” was cut — PRODUCT.md bans hustle language by name.">
              <Calendar profile={f.profile} sessions={f.sessions} onOpenDay={f.noop} />
            </Frame>
            <Frame n="17" name="Day detail" note="What you lifted, what you wrote, what you looked like. A rest day says so rather than apologising.">
              <DayDetail
                date={f.lastSession.date}
                session={{ ...f.lastSession, note: "Felt strong. Bar speed was good on the last set." }}
                onBack={f.noop}
              />
            </Frame>
            <Frame n="17b" name="Day detail · with a crew" note="The same day once someone else is in it: who trained, their photo, and what they said about yours. Never a weight and never a rank.">
              <DayDetail
                date={f.lastSession.date}
                session={{ ...f.lastSession, note: "Felt strong. Bar speed was good on the last set." }}
                crewPreview={f.crewDay}
                onBack={f.noop}
              />
            </Frame>
            <Frame n="—" name="Goal" note="One lift, one number, one date. Measured from where you started, so a slow week never subtracts.">
              <GoalScreen
                goal={f.goal}
                sessions={f.sessions}
                routines={f.routines}
                onSave={f.noop}
                onClear={f.noop}
                onBack={f.noop}
              />
            </Frame>
          </Group>

          <Group title="Control" sub="Yours to change, and honest about what it does not have.">
            <Frame n="18" name="Your data" note="One file with every session, note and photo. Import treats the file as hostile: malformed sessions and non-image data are dropped.">
              <div className="p-6">
                <YourData state={f.state} onImport={f.noop} />
              </div>
            </Frame>
            <Frame n="14" name="Edit the week" note="The deck's second journey. Until this existed, a plan you disagreed with was a plan you were stuck with.">
              <RoutineEditor
                profile={f.profile}
                routines={f.routines}
                onSave={f.noop}
                onBack={f.noop}
              />
            </Frame>
<Frame n="14b" name="Add a lift · ask" note="For the person who does not know the names yet. The model only picks from the same shortlist the buttons show, and the server checks its answer against that list — the worst case is it suggesting what the screen would have suggested anyway. ">
              <RoutineEditor
                initialAdding="core"
                profile={f.profile}
                routines={f.routines}
                onSave={f.noop}
                onBack={f.noop}
              />
            </Frame>
            <Frame n="10" name="Crew" tab="crew" note="A target, not a ranking, and no invented people. Beginners quit leaderboards, not gyms.">
              <Crew
                profile={f.profile}
                sessions={f.sessions}
                challenge={challenge}
                onChallenge={f.noop}
              />
            </Frame>
            <Frame n="10b" name="Crew · joined" note="Joined by a code somebody read out, never by an account. Days trained and nothing else — the schema has no column for a weight.">
              <Crew
                profile={f.profile}
                sessions={f.sessions}
                challenge={{ month: new Date().toISOString().slice(0, 7), target: 12 }}
                crewPreview={f.crew}
                onChallenge={f.noop}
              />
            </Frame>
            <Frame n="10c" name="Crew · join" note="Six characters with no O, I, L or U in the alphabet, because the failure mode is reading a code out across a gym floor.">
              <Crew
                profile={f.profile}
                sessions={f.sessions}
                challenge={{ month: new Date().toISOString().slice(0, 7), target: 12 }}
                crewPreview={{ code: null, members: [] }}
                onChallenge={f.noop}
              />
            </Frame>
          </Group>

          <Group title="Not in the app" sub="Frames from the Figma that no screen answers, said plainly rather than left blank.">
            <NotBuilt
              n="13"
              name="Workouts · past routines"
              why="A library of saved routines. Arguably solved already: routines are editable in place (14), so a separate library would be a second way to do one thing."
            />
            <NotBuilt
              n="12"
              name="Reminder"
              why="Built, but not as a screen. A web app cannot schedule a local notification — Notification Triggers never shipped and Web Push needs a server — so the reminder is a calendar event with an alarm, set from the calendar."
            />
          </Group>

          <p className="mt-16 max-w-[70ch] text-[15px] text-dim">
            Photos are stored per browser, so the calendar and day-detail frames show their
            empty photo state here unless you have added some in this browser.
          </p>
    </>
  );
}

export default function Frames() {
  const [scale, setScale] = useState(1);
  const [shot, setShot] = useState<{ n: string; scroll: number } | null>(null);
  const challenge = challengeFor(f.profile, undefined);

  // Read on the client only: the page stays static, and there is no Suspense
  // boundary to add for one query parameter.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = q.get("shot");
    if (n !== null) setShot({ n, scroll: Number(q.get("scroll") ?? 0) || 0 });
  }, []);

  if (shot !== null) {
    return (
      <Shot.Provider value={shot}>
        <div className="fixed inset-0 z-50 bg-ground">{gallery(challenge)}</div>
      </Shot.Provider>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-deep">
      <div className="mx-auto max-w-[1600px] px-8 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label text-cyan">HabitaBull</p>
            <h1 className="statement mt-2 text-[52px] text-fg">Every screen at once</h1>
            <p className="mt-1.5 max-w-[62ch] text-[17px] text-dim">
              The real components against stand-in data — not exported images, so this cannot
              drift out of date. Each frame is clipped to 390 × 844, the only size the app is
              designed at. Screens scroll inside their own frame.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="label text-dim">Size</span>
            {[0.6, 0.8, 1].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScale(s)}
                aria-pressed={scale === s}
                className={`head h-11 rounded-full border px-4 text-[15px] transition-colors ${
                  scale === s
                    ? "border-cyan bg-cyan text-ground"
                    : "border-line-strong text-dim hover:border-fg"
                }`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </header>

        <div
          className="mt-10 origin-top-left"
          style={{ zoom: scale }}
        >
          {gallery(challenge)}
        </div>
      </div>
    </div>
  );
}
