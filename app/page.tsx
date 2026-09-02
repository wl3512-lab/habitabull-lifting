"use client";

import { useEffect, useState } from "react";
import AfterWorkout from "@/components/AfterWorkout";
import Calendar from "@/components/Calendar";
import DayDetail from "@/components/DayDetail";
import Crew from "@/components/Crew";
import ExerciseInfo from "@/components/ExerciseInfo";
import Finished from "@/components/Finished";
import GoalScreen from "@/components/GoalScreen";
import LogSession from "@/components/LogSession";
import Onboarding from "@/components/Onboarding";
import Progress from "@/components/Progress";
import RoutineEditor from "@/components/RoutineEditor";
import TabBar, { type Tab } from "@/components/TabBar";
import Today from "@/components/Today";
import WeekSetup from "@/components/WeekSetup";
import {
  buildSession,
  generateRoutine,
  mergeRebuild,
  personalRecord,
  rebuildDay,
} from "@/lib/engine";
import { enabled, pushCheckins } from "@/lib/cloud";
import { challengeFor } from "@/lib/crew";
import { EMPTY, load, save, sessionFor, todayISO, upsertSession } from "@/lib/storage";
import type { Constraints } from "@/lib/constraints";
import type { AppState, Challenge, Goal, Profile, Routine, Session } from "@/lib/types";

type View = "today" | "log" | "done" | "progress" | "goal" | "exercise" | "calendar" | "crew" | "week" | "routine" | "after" | "day";

export default function Page() {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [records, setRecords] = useState<string[]>([]);
  const [today, setToday] = useState(() => todayISO());
  // Where an exercise detail screen returns to, so it can open from anywhere.
  const [detail, setDetail] = useState<{ id: string; from: View } | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  useEffect(() => {
    setState(load());
    setToday(todayISO());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(state);
  }, [state, ready]);

  /*
    Tell the crew which days she trained — the dates, and nothing else. It runs
    on the completed count rather than on every keystroke of a live session, so
    a workout in progress is nobody's business until it is finished.
  */
  const completed = state.sessions.filter((s) => s.completedAt).length;
  useEffect(() => {
    if (!ready || !enabled()) return;
    void pushCheckins(
      state.sessions.filter((s) => s.completedAt).map((s) => s.date)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, completed]);

  if (!ready) return <div className="flex-1" aria-busy="true" />;

  const { profile, routines, sessions, goal } = state;

  if (!profile) {
    return (
      <Onboarding
        onDone={(p: Profile) =>
          setState({
            profile: p,
            routines: generateRoutine(p.level, p.trainingDays, p.equipment),
            sessions: [],
            goal: null,
          })
        }
      />
    );
  }

  const dow = new Date(today + "T00:00:00").getDay();
  const scheduled = routines.find((r) => r.day === dow) ?? null;
  const draft = sessionFor(sessions, today);
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

  function startLogging() {
    if (!profile) return;
    if (!draft && routine) {
      setState((s) => ({
        ...s,
        sessions: upsertSession(s.sessions, {
          ...buildSession(routine, s.sessions, profile.level, today),
          startedAt: new Date().toISOString(),
        }),
      }));
    }
    setView("log");
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
        mergeRebuild(
          sessionFor(s.sessions, today),
          buildSession(rebuilt, s.sessions, profile.level, today)
        )
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

  function saveGoal(g: Goal) {
    setState((s) => ({ ...s, goal: g, goalDismissed: true }));
    setView("progress");
  }

  function finish() {
    if (!draft) return;
    const prior = sessions.filter((s) => s.date !== today);
    const hit = draft.exercises
      .filter((e) => {
        const best = Math.max(0, ...e.sets.filter((s) => s.done).map((s) => s.weight));
        return best > 0 && best > personalRecord(prior, e.exerciseId);
      })
      .map((e) => e.exerciseId);

    setRecords(hit);
    setState((s) => ({
      ...s,
      sessions: upsertSession(s.sessions, {
        ...draft,
        // Drop untouched sets so history reflects what was actually done.
        exercises: draft.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })),
        completedAt: new Date().toISOString(),
      }),
    }));
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
        {node}
        <TabBar active={tab} onChange={(t) => setView(t)} />
      </>
    );
  }

  if (view === "after") {
    const finished = sessionFor(sessions, today);
    if (finished) {
      return (
        <AfterWorkout
          session={finished}
          records={records}
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
        onSave={(r: Routine[]) => {
          // Saving the plan is the moment she has actually chosen it, so the
          // first-run prompt retires.
          setState((s) => ({
            ...s,
            routines: r,
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
          // A changed week means changed routines; sessions already logged stay.
          setState((s) => ({
            ...s,
            profile: p,
            routines: generateRoutine(p.level, p.trainingDays, p.equipment),
          }));
          setView("today");
        }}
        onSkip={() => setView("today")}
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
      />,
      "crew"
    );
  }

  if (view === "calendar") {
    return placed(
      <Calendar
        profile={profile}
        sessions={sessions}
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
        onImport={(next: AppState) => {
          setState(next);
          setView("today");
        }}
      />,
      "progress"
    );
  }

  if (view === "log" && draft) {
    return (
      <LogSession
        session={draft}
        history={sessions.filter((s) => s.date !== today)}
        onChange={updateDraft}
        onFinish={finish}
        onExit={() => setView("today")}
        onExercise={(id) => openExercise(id, "log")}
      />
    );
  }

  if (view === "done") {
    const finished = sessionFor(sessions, today);
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

  return placed(
    <Today
      profile={profile}
      routine={todayPlan}
      sessions={sessions}
      today={today}
      onStart={startLogging}
      onConstraints={applyConstraints}
      onExercise={(id) => openExercise(id, "today")}
      onProfile={(p: Profile) => setState((s) => ({ ...s, profile: p }))}
      onSetUpWeek={() => setView("week")}
      onEditRoutine={() => setView("routine")}
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
