export type Level = "new" | "returning" | "experienced";
export type Equipment = "barbell" | "dumbbell" | "machine" | "bodyweight" | "kettlebell";
export type Muscle = "quads" | "hamstrings" | "glutes" | "chest" | "back" | "shoulders" | "arms" | "core";

export interface Exercise {
  id: string;
  name: string;
  equipment: Equipment;
  primary: Muscle;
  /** smallest sensible weight jump, in lb */
  increment: number;
  /** compound lifts progress slower but carry the session */
  compound: boolean;
  cue: string;
  /** How to do it, in order. Shown on the exercise screen. */
  steps: string[];
  /** What goes wrong most often. Named plainly, never scolding. */
  mistakes: string[];
}

export interface TargetSet {
  weight: number;
  reps: number;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface Routine {
  /** 0 = Sunday, matching Date.getDay() */
  day: number;
  label: string;
  exercises: PlannedExercise[];
}

export interface LoggedSet {
  weight: number;
  reps: number;
  done: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

export interface Session {
  /** ISO date, local, YYYY-MM-DD */
  date: string;
  label: string;
  exercises: LoggedExercise[];
  completedAt?: string;
}

export interface Profile {
  name: string;
  level: Level;
  /** day numbers, 0-6 */
  trainingDays: number[];
  equipment: Equipment[];
  /**
   * Why they train, in their own words. From the sobriety-app research (deck
   * p9): I Am Sober asks why someone wants to get sober, because self-determined
   * reasons hold people where imposed ones do not. It is quoted back on the days
   * they do not feel like it, and the app never rewrites it — improving on how
   * someone said their own reason is the fastest way to make it stop being
   * theirs.
   */
  motivation?: string;
  /**
   * Minutes from midnight. Habit principle 2 (deck p12) is "establish time when
   * you will do it" — days alone are a preference, a day plus an hour is an
   * implementation intention, and that distinction is most of why this works.
   */
  trainingMinute?: number;
  createdAt: string;
}

/**
 * One concrete, dated target — "Deadlift 200 lbs by May 1st", from the deck.
 * Optional and never asked for during setup: the research was clear that people
 * want to log a workout before they'll commit to a goal.
 */
export interface Goal {
  exerciseId: string;
  targetWeight: number;
  /** ISO date, YYYY-MM-DD */
  targetDate: string;
}

export interface AppState {
  profile: Profile | null;
  routines: Routine[];
  sessions: Session[];
  goal: Goal | null;
  /** Set once the user has declined to set a goal, so we stop asking. */
  goalDismissed?: boolean;
}
