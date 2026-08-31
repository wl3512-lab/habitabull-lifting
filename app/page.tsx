"use client";

import { useEffect, useState } from "react";
import ExerciseInfo from "@/components/ExerciseInfo";
import Finished from "@/components/Finished";
import GoalScreen from "@/components/GoalScreen";
import LogSession from "@/components/LogSession";
import Onboarding from "@/components/Onboarding";
import Progress from "@/components/Progress";
import Today from "@/components/Today";
import { buildSession, generateRoutine, personalRecord, rebuildDay } from "@/lib/engine";
import { EMPTY, load, save, sessionFor, todayISO, upsertSession } from "@/lib/storage";
import type { Constraints } from "@/lib/constraints";
import type { AppState, Goal, Profile, Session } from "@/lib/types";

type View = "today" | "log" | "done" | "progress" | "goal" | "exercise";

export default function Page() {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [records, setRecords] = useState<string[]>([]);
  const [today, setToday] = useState(() => todayISO());
  // Where an exercise detail screen returns to, so it can open from anywhere.
  const [detail, setDetail] = useState<{ id: string; from: View } | null>(null);

  useEffect(() => {
    setState(load());
    setToday(todayISO());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(state);
  }, [state, ready]);

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
  const routine = scheduled ?? routines.find((r) => r.day > dow) ?? routines[0] ?? null;

  function startLogging() {
    if (!profile) return;
    if (!draft && routine) {
      setState((s) => ({
        ...s,
        sessions: upsertSession(s.sessions, buildSession(routine, s.sessions, profile.level, today)),
      }));
    }
    setView("log");
  }

  function applyConstraints(c: Constraints) {
    if (!profile || !routine) return;
    const equipment = c.equipment.length ? c.equipment : profile.equipment;
    const rebuilt = rebuildDay(routine, profile.level, equipment, c.avoid);
    setState((s) => ({
      ...s,
      routines: s.routines.map((r) => (r.day === rebuilt.day ? rebuilt : r)),
      // Any untouched draft for today is stale now; it rebuilds on next start.
      sessions: s.sessions.filter((x) => x.date !== today || x.completedAt),
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
        onBack={() => setView(detail.from)}
      />
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
    return (
      <Progress
        sessions={sessions}
        goal={goal}
        onBack={() => setView("today")}
        onGoal={() => setView("goal")}
      />
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
        />
      );
    }
  }

  return (
    <Today
      profile={profile}
      routine={scheduled}
      sessions={sessions}
      today={today}
      onStart={startLogging}
      onConstraints={applyConstraints}
      onProgress={() => setView("progress")}
      onExercise={(id) => openExercise(id, "today")}
    />
  );
}
