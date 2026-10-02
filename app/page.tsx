"use client";

import { useEffect, useRef, useState } from "react";
import AfterWorkout from "@/components/AfterWorkout";
import Calendar from "@/components/Calendar";
import DayDetail from "@/components/DayDetail";
import CopyWorkout from "@/components/CopyWorkout";
import Crew from "@/components/Crew";
import ExerciseInfo from "@/components/ExerciseInfo";
import Finished from "@/components/Finished";
import GoalScreen from "@/components/GoalScreen";
import LoadTheBar from "@/components/LoadTheBar";
import LogSession from "@/components/LogSession";
import Onboarding from "@/components/Onboarding";
import ProfileScreen from "@/components/Profile";
import Arrival from "@/components/Arrival";
import Booting from "@/components/Booting";
import StoppedEarly from "@/components/StoppedEarly";
import Comeback from "@/components/Comeback";
import ImportWorkout from "@/components/ImportWorkout";
import PickWorkout, { type WorkoutChoice } from "@/components/PickWorkout";
import Progress from "@/components/Progress";
import RoutineEditor from "@/components/RoutineEditor";
import TabBar, { type Tab } from "@/components/TabBar";
import TabView from "@/components/TabView";
import Today from "@/components/Today";
import WeekSetup from "@/components/WeekSetup";
import {
  buildSession,
  rememberLineup,
  mergeDayLibrary,
  generateRoutine,
  unfilled,
  reconcileWeek,
  mergeRebuild,
  personalRecord,
  rebuildDay,
} from "@/lib/engine";
import { finishSession } from "@/lib/session-memory";
import { attended, checkinDates } from "@/lib/attendance";
import { applyPlan } from "@/lib/plan";
import { enabled, publishPlan, pushCheckins } from "@/lib/cloud";
import { setCustomExercises } from "@/lib/exercises";
import { relabel, removeWorkout, renameWorkout, saveWorkout, syncWorkouts, withSharedWorkout } from "@/lib/workouts";
import { challengeFor } from "@/lib/crew";
import { launchPlaylist } from "@/lib/spotify";
import { greetingMood } from "@/lib/voice";
import {
  EMPTY,
  load,
  save,
  sessionFor,
  todayISO,
  upsertSession,
  upsertWeighIn,
} from "@/lib/storage";
import { arrivalMood, lastGreeting, rememberGreeting, type ArrivalMood } from "@/lib/arrival";
import { nextTrainingDay } from "@/lib/schedule";
import { weekStrip } from "@/lib/calendar";
import { setBusy } from "@/lib/busy";
import type { SharedDay } from "@/lib/cloud";
import type { Constraints } from "@/lib/constraints";
import type { AppState, Challenge, Goal, Profile, Routine, SavedWorkout, Session } from "@/lib/types";

/**
 * What a quick workout is called, on the home screen, in the calendar and in
 * history. Named rather than left blank because every other session has a name
 * and a blank one would read as a bug — and not named after the weekday it fell
 * on, which is the thing a quick workout deliberately is not.
 */
const QUICK_LABEL = "Quick workout";

function copyableWeek(routines: Routine[]): SharedDay[] {
  return routines.map((r) => ({
    day: r.day,
    label: r.label,
    exercises: r.exercises.map((e) => e.exerciseId),
  }));
}

type View = "copy" | "today" | "log" | "done" | "progress" | "goal" | "exercise" | "calendar" | "crew" | "week" | "routine" | "after" | "day" | "profile" | "plates" | "comeback" | "stopped" | "import" | "pick";

export default function Page() {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  /*
    Which weekday the routine editor opens on, when it was reached by pointing
    at one. Null means the plan as a whole, which is what the "Your workouts"
    edit link and the first run both mean.
  */
  const [planDay, setPlanDay] = useState<number | null>(null);
  const [records, setRecords] = useState<string[]>([]);
  const [today, setToday] = useState(() => todayISO());
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const workoutDate = ["log", "done", "after", "stopped", "comeback", "exercise"].includes(view)
    ? activeDate ?? today : today;

  useEffect(() => {
    const updateDay = () => setToday(todayISO());
    window.addEventListener("focus", updateDay);
    document.addEventListener("visibilitychange", updateDay);
    const interval = window.setInterval(updateDay, 30000);
    return () => {
      window.removeEventListener("focus", updateDay);
      document.removeEventListener("visibilitychange", updateDay);
      window.clearInterval(interval);
    };
  }, []);
  // Where an exercise detail screen returns to, so it can open from anywhere.
  const [detail, setDetail] = useState<{ id: string; from: View } | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [copying, setCopying] = useState<{ day: SharedDay; from: string } | null>(null);
  /*
    The beat the app opens on, and whether it has already played.

    `arrival` is the mood being shown right now and null the rest of the time;
    `welcomed` records that today's beat was a welcome back, which is what stops
    the same person being welcomed a second time when they start their workout.
    Both are decided once, on the load that reads storage, because the answer
    depends on the state that load returns and must not change under them
    afterwards.
  */
  const [arrival, setArrival] = useState<ArrivalMood | null>(null);
  /*
    What a rebuild from the list understood. Today used to hold this itself,
    but the sentence can now be asked from the list, and the line has to
    survive the trip back to Today to be read. It carries the date it was said
    on because the day can roll over while the app stays open, and the next
    day's plan must not show yesterday's sentence.
  */
  const [adjusted, setAdjusted] = useState<{ date: string; line: string }>({ date: "", line: "" });
  const [welcomed, setWelcomed] = useState(false);
  // Set when the beat hands over, so Today rises into place rather than simply
  // appearing. A ref, not state: it is read during the render that dismissing
  // the beat already causes, and never needs to cause one of its own.
  const handedOff = useRef(false);

  useEffect(() => {
    const loaded = load();
    const t = todayISO();
    setState(loaded);
    setToday(t);
    setReady(true);

    const greeted = lastGreeting();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const mood = arrivalMood(loaded, t, { greeted, reduced });
    if (mood) {
      setArrival(mood);
      rememberGreeting({ date: t, mood });
    }
    // A welcome already given today counts whether it was given this minute or
    // this morning, or closing the app would buy a second one.
    setWelcomed(mood === "return" || (greeted?.date === t && greeted.mood === "return"));
  }, []);

  useEffect(() => {
    // Whether this landed is broadcast by `save` and picked up by NotSaving at
    // the root, which is the only element that renders on every path.
    if (ready) save(state);
  }, [state, ready]);

  /*
    The stretch nobody may interrupt: a workout, from the first set to the beat
    that ends it. StayFresh reads this before picking up a new build, because
    the one place a reload costs something is standing at a rack halfway
    through a session. Everywhere else the app rebuilds from storage and lands
    where a resumed app lands anyway.
  */
  const mid =
    view === "log" || view === "done" || view === "comeback" || view === "stopped";
  useEffect(() => {
    setBusy(mid);
    return () => setBusy(false);
  }, [mid]);

  /*
    Tell the crew which days she trained — the dates, and nothing else. It runs
    on the count of those days rather than on every keystroke of a live session,
    so a workout in progress is nobody's business until it is finished. A day
    she stopped partway is told once the date turns (see `checkinDates`).
  */
  /*
    Publish the week for the crew to copy. It carries the day labels and the
    exercise ids and nothing else — no weight, no set, no rep — so what crosses
    is which lifts she does, never how much she lifts. Anyone copying it gets
    their own engine's numbers.

    On by default inside a crew she joined by reading somebody a code, with an
    off switch on that screen. Silent is the wrong default for a photo; a list
    of exercise names is not the same kind of thing.
  */
  const planKey = JSON.stringify(copyableWeek(state.routines));
  useEffect(() => {
    if (!ready || !enabled() || state.profile?.shareWeek === false) return;
    void publishPlan(copyableWeek(state.routines));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, planKey, state.profile?.shareWeek]);

  const checkins = checkinDates(state.sessions, today);
  const checkedIn = checkins.length;
  useEffect(() => {
    if (!ready || !enabled()) return;
    void pushCheckins(checkins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, checkedIn]);

  if (!ready) return <Booting />;

  const { profile, routines, sessions, goal } = state;

  if (!profile) {
    return (
      <Onboarding
        onDone={(p: Profile) =>
          setState({
            profile: p,
            // Named days with nothing on them. The first thing after this is
            // the week screen and then the day editor, where "Autofill for me"
            // is waiting for anyone who wants the app to choose.
            routines: unfilled(generateRoutine(p.level, p.trainingDays, p.equipment)),
            sessions: [],
            goal: null,
          })
        }
      />
    );
  }

  /*
    Before anything else the app has to show, once a day: what today is.

    Sits after onboarding and before every other view, because it is about the
    day rather than about a screen — and whether it appears at all was decided
    on load, in `arrivalMood`, against rules that keep it quiet far more often
    than not.
  */
  const dow = new Date(today + "T00:00:00").getDay();
  const scheduled = routines.find((r) => r.day === dow) ?? null;

  if (arrival) {
    return (
      <Arrival
        mood={arrival}
        seed={today.length + profile.name.length}
        nextDay={nextTrainingDay(profile.trainingDays, today)}
        // What today is called, so the beat says "Leg day" rather than "Today".
        label={scheduled?.label}
        // The week behind her, which is what a rest day is about.
        week={weekStrip(sessions, profile.trainingDays, today)}
        onDone={() => {
          handedOff.current = true;
          setArrival(null);
        }}
      />
    );
  }

  const draft = sessionFor(sessions, workoutDate);
  // On a rest day, "train anyway" pulls up the next routine in the rotation.
  // Sorted before the wrap-around: unsorted, "the next training day" can pick
  // a day that has already passed.
  const byDay = [...routines].sort((a, b) => a.day - b.day);
  const routine = scheduled ?? byDay.find((r) => r.day > dow) ?? byDay[0] ?? null;

  // What today actually is. An unfinished draft outranks the stored routine, so
  // a temporary swap ("only dumbbells today") shows on the home screen straight
  // away without that swap being written back into the plan.
  const todayPlan: Routine | null =
    draft && !draft.completedAt
      ? {
          day: dow,
          label: draft.label,
          exercises: draft.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.length,
            reps: e.sets[0]?.reps ?? 0,
            weight: e.sets[0]?.weight ?? 0,
          })),
        }
      : scheduled;

  /**
   * Whether starting a workout right now is a comeback.
   *
   * A gap of a week or more gets its own beat before the first set — unless the
   * arrival beat already said it this morning. One welcome back a day, at the
   * door rather than again on the way to the bar. Shared by both ways in, since
   * the gap is a fact about her week and not about which button she pressed.
   */
  function comebackNow(): boolean {
    const lastDone = state.sessions
      .filter((x) => attended(x) && x.date < today)
      .map((x) => x.date)
      .sort()
      .pop();
    return !welcomed && greetingMood(lastDone, today) === "return";
  }

  /**
   * A workout with no plan behind it, logged one lift at a time.
   *
   * The plan is the app's opinion, and there are days it has no useful one:
   * a drop-in at a gym with different kit, a morning where she already knows
   * what she is doing, a first session before anybody has agreed to a week —
   * which is the research finding the whole home screen is built on, that
   * people want to log a workout before they will set anything up.
   *
   * It opens with the session genuinely empty rather than with a guess in it.
   * `freestyle` is what tells the log screen that empty means "pick your first
   * lift" and tells `rememberLineup` not to write this improvisation back over
   * a saved day.
   */
  function startQuick() {
    if (!profile || draft) return; // one record per date; never over a session
    setActiveDate(today);
    launchPlaylist(profile.playlistId);
    setState((s) => ({
      ...s,
      sessions: upsertSession(s.sessions, {
        date: today,
        label: QUICK_LABEL,
        exercises: [],
        startedAt: new Date().toISOString(),
        freestyle: true,
      }),
    }));
    setView(comebackNow() ? "comeback" : "log");
  }

  function startLogging() {
    if (!profile) return;
    setAdjusted({ date: "", line: "" });
    /*
      Fired here, on the same tick as the tap, so the browser still treats the
      window it opens as user-activated. Before the state write rather than
      after: if music is going to fail it should fail before anything has been
      committed, and the call itself swallows everything anyway.
    */
    setActiveDate(today);
    launchPlaylist(profile.playlistId);
    const isComeback = comebackNow();
    if (!draft && routine) {
      setState((s) => ({
        ...s,
        sessions: upsertSession(s.sessions, {
          ...buildSession(routine, s.sessions, profile.level, today),
          startedAt: new Date().toISOString(),
        }),
      }));
    }
    setView(isComeback ? "comeback" : "log");
  }

  /**
   * A workout she chose on a day the plan says rest.
   *
   * Built through `buildSession` like any other day, so the weights and reps
   * are the ones her history says, not the ones frozen into the workout when
   * she saved it. The label is the workout's, so the session reads as the thing
   * she chose everywhere it is shown later.
   *
   * Marked `adapted`, which is what stops it redefining anything: today is not
   * this workout's day, and a leg day done on a Sunday is not a decision that
   * Sunday is leg day. It also puts the "keep this?" offer on the screen
   * afterwards, which is the right offer for a day that came from nowhere.
   */
  function startFrom(choice: WorkoutChoice) {
    if (!profile || draft) return; // one record per date; never over a session
    setActiveDate(today);
    launchPlaylist(profile.playlistId);
    const isComeback = comebackNow();
    setState((s) => ({
      ...s,
      sessions: upsertSession(s.sessions, {
        ...buildSession(
          { day: dow, label: choice.label, template: choice.template, exercises: choice.exercises },
          s.sessions,
          profile.level,
          today
        ),
        startedAt: new Date().toISOString(),
        adapted: true,
      }),
    }));
    setView(isComeback ? "comeback" : "log");
  }

  /**
   * "Something hurts today" changes today, and only today.
   *
   * This used to write the rebuilt day back into `routines`, which meant saying
   * "my shoulder is tweaked" once quietly removed shoulder work from every
   * future Monday. The 2023 note was explicit that the change is temporary —
   * the whole point of the flexibility principle is adapting a session without
   * losing the plan you adapted from. The saved routine is left alone and the
   * rebuild lands in today's draft session instead.
   */
  function applyConstraints(c: Constraints) {
    if (!profile || !routine) return;
    const equipment = c.equipment.length ? c.equipment : profile.equipment;
    const rebuilt = rebuildDay(routine, profile.level, equipment, c.avoid);
    setState((s) => ({
      ...s,
      sessions: upsertSession(
        s.sessions.filter((x) => x.date !== today || x.completedAt),
        {
          ...mergeRebuild(
            sessionFor(s.sessions, today),
            buildSession(rebuilt, s.sessions, profile.level, today)
          ),
          adapted: true,
        }
      ),
    }));
  }

  function updateDraft(next: Session) {
    setState((s) => ({ ...s, sessions: upsertSession(s.sessions, next) }));
  }

  function openExercise(id: string, from: View) {
    setDetail({ id, from });
    setView("exercise");
  }

  /** One entry per day; logging twice corrects the day rather than appending. */
  function saveWeighIn(lb: number) {
    setState((s) => ({
      ...s,
      weighIns: upsertWeighIn(s.weighIns ?? [], { date: today, lb }),
    }));
  }

  function saveGoal(g: Goal) {
    setState((s) => ({ ...s, goal: g, goalDismissed: true }));
    setView("progress");
  }

  /*
    Her own saved workouts.

    Both writers commit on their own rather than riding along with a plan save,
    because the library is not the plan: she can save a workout from the screen
    that ends a session, where there is no plan edit in flight at all, and
    cancelling an edit to Wednesday must not take back a workout she kept while
    she was in there.
  */
  /**
   * A restored backup, replacing everything.
   *
   * The registry is filled before the state lands, for the same reason adding a
   * lift by hand fills it first: it is a module variable, so writing it does not
   * re-render anything. `save` does register it, but that runs in an effect
   * *after* the render the new state causes — so the first screen after a
   * restore drew every custom lift as its raw id
   * ("custom-cable-crossover-mtluc…") and stayed that way until something else
   * happened to refresh it. Which is on the screen the restore lands on: Today
   * lists the lifts in her plan.
   */
  function importState(next: AppState) {
    setCustomExercises(next.customExercises ?? []);
    setState(next);
    setView("today");
  }

  function keepWorkout(w: SavedWorkout) {
    setState((s) => ({ ...s, workouts: saveWorkout(s.workouts, w) }));
  }

  function dropWorkout(id: string) {
    setState((s) => ({ ...s, workouts: removeWorkout(s.workouts, id) }));
  }

  // A rename is committed at once, like saving one, and reaches the days it is
  // on in the saved week too, so cancelling the editor afterwards cannot leave
  // Monday under the old name.
  function renameOwn(id: string, name: string) {
    setState((s) => ({
      ...s,
      workouts: renameWorkout(s.workouts, id, name),
      routines: relabel(s.routines, id, name),
    }));
  }

  async function shareWorkoutWithCrew(day: SharedDay): Promise<boolean> {
    const week = state.profile?.shareWeek === false ? [] : copyableWeek(state.routines);
    const res = await publishPlan(withSharedWorkout(week, day));
    return Boolean(res?.shared);
  }

  function finish(next?: Session) {
    const finishing = next ?? draft;
    if (!finishing) return;
    if (!finishing.exercises.some(e => e.sets.some(s => s.done))) {
      setView("today");
      return;
    }
    const prior = sessions.filter((s) => s.date < finishing.date);
    const hit = finishing.exercises
      .filter((e) => {
        const best = Math.max(0, ...e.sets.filter((s) => s.done).map((s) => s.weight));
        return best > 0 && best > personalRecord(prior, e.exerciseId);
      })
      .map((e) => e.exerciseId);

    setRecords(hit);
    setState((s) => {
      // Remember the lineup you actually trained. buildSession takes its
      // exercise list from the routine, so writing today's lineup back means the
      // next time this day comes up your workout returns — the lift you added,
      // the one you dropped — instead of the starting template. Weights still
      // progress from history, so only the choice of exercises is carried over.
      // A one-off "something hurts" rebuild is exempt: it changes only today.
      // Next time this day comes up, the workout you actually did returns; the
      // day library keeps it per day type, so pressing that day again does too.
      const routines = finishing.date === today ? rememberLineup(s.routines, finishing) : s.routines;
      return {
        ...s,
        routines,
        dayLibrary: mergeDayLibrary(s.dayLibrary, routines),
        // And into the saved workout, if this day is one. A lift added at the
        // rack is an edit to her workout exactly as much as one added in the
        // editor is, and only one of the two used to survive.
        workouts: syncWorkouts(s.workouts, routines),
        sessions: upsertSession(s.sessions, finishSession(finishing, new Date().toISOString())),
      };
    });
    setView("done");
  }

  if (view === "exercise" && detail) {
    return (
      <ExerciseInfo
        exerciseId={detail.id}
        sessions={sessions}
        profile={profile}
        onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
        onBack={() => setView(detail.from)}
      />
    );
  }


  /** Wraps a top-level screen with the tab bar. Modes never get one. */
  function placed(node: React.ReactNode, tab: Tab) {
    return (
      <>
        <TabView
        tab={tab}
        handoff={handedOff.current}
        // Today assembles itself block by block, which is the entrance the
        // wrapper would otherwise be providing.
        staged={tab === "today"}
      >
          {node}
        </TabView>
        <TabBar active={tab} onChange={(t) => setView(t)} />
      </>
    );
  }

  if (view === "after") {
    const finished = sessionFor(sessions, workoutDate);
    if (finished) {
      return (
        <AfterWorkout
          session={finished}
          records={records}
          profile={profile}
          workouts={state.workouts}
          onSaveWorkout={keepWorkout}
          onShareWorkout={shareWorkoutWithCrew}
          onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
          onSave={(note?: string) => {
            setState((s) => ({
              ...s,
              sessions: upsertSession(s.sessions, { ...finished, note }),
            }));
            setView("today");
          }}
          onSkip={() => setView("today")}
        />
      );
    }
  }

  if (view === "day" && dayOpen) {
    return (
      <DayDetail
        date={dayOpen}
        session={sessions.find((s) => s.date === dayOpen)}
        onBack={() => setView("calendar")}
      />
    );
  }

  if (view === "routine") {
    return (
      <RoutineEditor
        profile={profile}
        routines={routines}
        focusDay={planDay ?? undefined}
        library={state.dayLibrary}
        workouts={state.workouts}
        onSaveWorkout={keepWorkout}
        onRemoveWorkout={dropWorkout}
        onRenameWorkout={renameOwn}
        onAddCustom={(e) => {
          /*
            The registry is filled here, not left to `save`. It is a module
            variable, so changing it does not re-render anything — and setState
            alone meant the new lift rendered as its own raw id
            ("custom-cable-crossover-mtluc…") until something else happened to
            refresh the screen. Registering first means the render setState
            causes already resolves the name.
          */
          const next = [...(state.customExercises ?? []), e];
          setCustomExercises(next);
          setState((s) => ({ ...s, customExercises: next }));
        }}
        onSave={(r: Routine[]) => {
          // Saving the plan is the moment she has actually chosen it, so the
          // first-run prompt retires.
          setState((s) => ({
            ...applyPlan(s, r, profile.level, today),
            profile: s.profile ? { ...s.profile, planChosen: true } : s.profile,
          }));
          setView("today");
        }}
        onBack={() => setView("today")}
      />
    );
  }

  if (view === "week") {
    return (
      <WeekSetup
        profile={profile}
        onSave={(p: Profile) => {
          /*
            A changed week means changed routines; sessions already logged stay.

            `reconcileWeek` keeps every day she still trains exactly as it was
            and generates only the new ones. This call used to rebuild the
            whole week with no day types at all, so adding a single day turned
            Push/Pull/Legs into four identical full-body days, and even with
            the types carried across, the full-body variant was positional, so
            the same edit still changed which lifts Wednesday had.
          */
          setState((s) => {
            const routines = reconcileWeek(
              s.routines,
              p.trainingDays,
              p.level,
              p.equipment,
              p.favourites ?? [],
              s.dayLibrary
            );
            return { ...applyPlan(s, routines, p.level, today), profile: p };
          });
          /*
            Where to go next.

            First time through, days are only half the answer — go straight on
            to what each day is, rather than dropping her back on a home screen
            that still says nothing is planned.

            After that it depended on nothing: every schedule edit returned to
            Today, so arriving at a brand-new Wednesday meant going back into
            the profile and finding it. A day that was not trained before is
            the one thing this edit created and the one thing it cannot answer,
            so that is where it lands. An edit that only moves days is already
            answered — the workout moved with it — and an edit that changes
            nothing has nothing to show.
          */
          const before = new Set(profile.trainingDays);
          const added = p.trainingDays.filter((d) => !before.has(d)).sort((a, b) => a - b);
          const removed = profile.trainingDays.filter((d) => !p.trainingDays.includes(d));
          const isMove = added.length > 0 && added.length <= removed.length;
          if (!profile.planChosen) {
            setPlanDay(null);
            setView("routine");
          } else if (added.length > 0 && !isMove) {
            setPlanDay(added[0]);
            setView("routine");
          } else {
            setPlanDay(null);
            setView("today");
          }
        }}
        onSkip={() => setView(profile.planChosen ? "today" : "routine")}
        onImport={() => setView("import")}
      />
    );
  }

  if (view === "import" && profile) {
    return (
      <ImportWorkout
        profile={profile}
        onCancel={() => setView("week")}
        onDone={(routines, customs) => {
          setState((s) => {
            const customExercises = [...(s.customExercises ?? []), ...customs];
            setCustomExercises(customExercises);
            return {
              ...applyPlan(s, routines, profile.level, today),
              customExercises,
              profile: {
                ...profile,
                planChosen: true,
                trainingDays: [...new Set(routines.map((r) => r.day))].sort((a, b) => a - b),
              },
            };
          });
          setView("today");
        }}
      />
    );
  }

  if (view === "copy" && copying) {
    return (
      <CopyWorkout
        source={copying.day}
        from={copying.from}
        routines={routines}
        profile={profile}
        onDone={(next: Routine[]) => {
          // Copying a day is choosing a plan, so the first-run prompt retires
          // the same way saving the editor does.
          setState((s) => ({
            ...applyPlan(s, next, profile.level, today),
            profile: s.profile ? { ...s.profile, planChosen: true } : s.profile,
          }));
          setCopying(null);
          setView("today");
        }}
        onCancel={() => {
          setCopying(null);
          setView("crew");
        }}
      />
    );
  }

  if (view === "crew") {
    // Regenerated here rather than on a timer: the month can turn while the
    // app sits open on a phone that never gets closed.
    const challenge = challengeFor(profile, state.challenge);
    return placed(
      <Crew
        profile={profile}
        sessions={sessions}
        challenge={challenge}
        onChallenge={(c: Challenge) => setState((s) => ({ ...s, challenge: c }))}
        onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
        onCopyWorkout={(day, from) => {
          setCopying({ day, from });
          setView("copy");
        }}
      />,
      "crew"
    );
  }

  if (view === "calendar") {
    return placed(
      <Calendar
        profile={profile}
        sessions={sessions}
        routines={routines}
        onOpenDay={(d: string) => {
          setDayOpen(d);
          setView("day");
        }}
      />,
      "calendar"
    );
  }

  if (view === "goal") {
    return (
      <GoalScreen
        goal={goal}
        sessions={sessions}
        routines={routines}
        onSave={saveGoal}
        onClear={() => {
          setState((s) => ({ ...s, goal: null, goalDismissed: true }));
          setView("progress");
        }}
        onBack={() => setView("progress")}
      />
    );
  }

  if (view === "progress") {
    return placed(
      <Progress
        sessions={sessions}
        goal={goal}
        onGoal={() => setView("goal")}
        state={state}
        onImport={importState}
      />,
      "progress"
    );
  }

  if (view === "profile" && profile) {
    return placed(
      <ProfileScreen
        profile={profile}
        state={state}
        today={today}
        onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
        onWeighIn={saveWeighIn}
        onImport={importState}
        onEditPlan={(day) => {
          setPlanDay(day ?? null);
          setView("routine");
        }}
        onEditWeek={() => setView("week")}
        onOpenPlates={() => setView("plates")}
      />,
      "profile"
    );
  }

  // Full screen, like the week editor: it is a mode of Profile, not a tab.
  if (view === "plates" && profile) {
    return (
      <LoadTheBar
        profile={profile}
        onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
        onBack={() => setView("profile")}
      />
    );
  }

  if (view === "comeback") {
    const seed = today.length + (profile?.name.length ?? 0);
    return <Comeback seed={seed} onDone={() => setView("log")} />;
  }

  if (view === "log" && draft) {
    return (
      <LogSession
        key={draft.date}
        session={draft}
        history={sessions.filter((s) => s.date < draft.date)}
        profile={profile}
        onChange={updateDraft}
        onAddCustom={(e) => {
          const next = [...(state.customExercises ?? []), e];
          setCustomExercises(next);
          setState((s) => ({ ...s, customExercises: next }));
        }}
        onFinish={finish}
        // Not straight home. Ending early is the one screen change in the app
        // that used to happen with no transition and no answer to "did I just
        // lose those sets?".
        //
        // A quick workout that never got a lift is the exception: nothing was
        // started, so there is nothing to reassure anyone about, and the empty
        // record has to go or Today reports a session with nothing in it.
        onExit={() => {
          if (draft.freestyle && draft.exercises.length === 0) {
            setState((s) => ({ ...s, sessions: s.sessions.filter((x) => x.date !== draft.date) }));
            setView("today");
            return;
          }
          setView("stopped");
        }}
        onExercise={(id) => openExercise(id, "log")}
        onProfile={(p2: Profile) => setState((s2) => ({ ...s2, profile: p2 }))}
      />
    );
  }

  if (view === "stopped") {
    const stopped = draft ?? sessionFor(sessions, today);
    if (stopped) {
      return (
        <StoppedEarly
          session={stopped}
          seed={today.length + profile.name.length}
          onDone={() => setView("today")}
        />
      );
    }
    // No session to speak of: fall through to the tabs, the way `done` does.
    // Calling setView here would be a state write during render.
  }

  if (view === "done") {
    const finished = sessionFor(sessions, workoutDate);
    if (finished) {
      return (
        <Finished
          session={finished}
          sessions={sessions}
          records={records}
          onHome={() => setView("today")}
          offerGoal={!goal && !state.goalDismissed}
          onSetGoal={() => setView("goal")}
          onAddDetail={() => setView("after")}
        />
      );
    }
  }

  if (view === "pick") {
    return (
      <PickWorkout
        profile={profile}
        workouts={state.workouts}
        routines={routines}
        dayLibrary={state.dayLibrary}
        today={dow}
        /*
          What today already is, when it is anything. The list shows it as the
          first card, so changing her mind is one tap and not a Cancel.
        */
        planned={todayPlan ? { label: todayPlan.label, exercises: todayPlan.exercises } : undefined}
        onStartPlanned={startLogging}
        onAdjust={(c, line) => {
          applyConstraints(c);
          setAdjusted({ date: today, line });
          setView("today");
        }}
        onPick={startFrom}
        onQuick={startQuick}
        onBack={() => setView("today")}
      />
    );
  }

  return placed(
    <Today
      profile={profile}
      routine={todayPlan}
      sessions={sessions}
      today={today}
      onResume={(date) => {
        setActiveDate(date);
        setView("log");
      }}
      onStart={startLogging}
      onQuick={startQuick}
      adjusted={adjusted.date === today ? adjusted.line : ""}
      /*
        "Train anyway" on a rest day, and Change on a day with a plan. Only with
        something to choose from: with an empty week and nothing saved the list
        would be an empty screen between her and a workout.
      */
      onPickWorkout={
        routines.length > 0 || (state.workouts?.length ?? 0) > 0
          ? () => setView("pick")
          : undefined
      }
      onConstraints={(c) => {
        // Today's own rebuild speaks for itself, so an older line from the
        // list must not reappear over it after a trip to another tab.
        setAdjusted({ date: "", line: "" });
        applyConstraints(c);
      }}
      onExercise={(id) => openExercise(id, "today")}
      onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
      onSetUpWeek={() => setView("week")}
      onEditRoutine={(day) => {
        setPlanDay(day ?? null);
        setView("routine");
      }}
      goal={goal}
      onGoal={() => setView("goal")}
      onOpenDay={(d: string) => {
        setDayOpen(d);
        setView("day");
      }}
    />,
    "today"
  );
}
