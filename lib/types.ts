import type { Anchor } from "./schedule";
import type { TemplateId } from "./templates";

export type Level = "new" | "returning" | "experienced";
export type RestPref = "short" | "standard" | "long";
export type Equipment = "barbell" | "dumbbell" | "machine" | "bodyweight" | "kettlebell";
export type Muscle = "quads" | "hamstrings" | "glutes" | "calves" | "chest" | "back" | "shoulders" | "arms" | "core";

export interface Exercise {
  id: string;
  name: string;
  equipment: Equipment;
  primary: Muscle;
  /** smallest sensible weight jump, in lb */
  increment: number;
  /** compound lifts progress slower but carry the session */
  compound: boolean;
  /**
   * Lifts that are trained heavy and low by convention. A novice deadlifting
   * for ten is the clearest sign nobody looked at the programme.
   */
  heavy?: boolean;
  /**
   * Reps are seconds. True for planks and holds, false for a weighted crunch —
   * which is why this is a property of the lift and not of the muscle. Core
   * used to mean "30 seconds" everywhere, and that was fine only while the
   * single core lift was a plank.
   */
  hold?: boolean;
  /** Time-based cardio: one set, logged in minutes, no weight. */
  cardio?: boolean;
  /** A cardio machine whose incline you can set. Logs an incline %% too. */
  incline?: boolean;
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
  /** Which named day this is. Absent on plans made before day types existed. */
  template?: TemplateId;
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
  /** Set when logging opens, so the summary can state a real duration. */
  startedAt?: string;
  completedAt?: string;
  /**
   * Her own words about the session. The deck asked for it twice (p29, p30) and
   * Ryder keeps a journal "because he can write anything he wants" — so it is a
   * free field, never a mood picker or a set of tags.
   */
  note?: string;
  /**
   * This day was rebuilt to work around a constraint ("something hurts"). It is
   * a one-off for today, so finishing it must not write the reduced lineup back
   * over the saved plan the way a deliberately edited day does.
   */
  adapted?: boolean;
}

/**
 * A dated body-weight entry.
 *
 * Deliberately not part of `Session`: weighing yourself is not training, and
 * tying the two together would mean a weigh-in on a rest day had nowhere to
 * live — which is most weigh-ins. `lb` matches the unit the rest of the app
 * logs in; there is no unit switch anywhere yet and adding one here alone
 * would be the only place in the product that asked.
 */
export interface WeighIn {
  /** ISO date, local, YYYY-MM-DD. One entry per day, last write wins. */
  date: string;
  lb: number;
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
   * Lifts she has starred. From the 2023 Miro board, which asked to "give
   * suggested exercises based on user's favorite exercises" and never got
   * built. A favourite is a preference, not a rule: it wins a coin toss when
   * two lifts train the same muscle, and never overrides the balance of a day.
   */
  favourites?: string[];
  /** Set once she has looked at the week and chosen. Until then the app is
      running on its own defaults and says so. */
  planChosen?: boolean;
  /** Whether the week is published for the crew to copy. Default on. */
  shareWeek?: boolean;
  /**
   * How the share switch on the after-workout screen was left last time, so
   * somebody who shares every session is not re-ticking the same box three
   * times a week. Default off, and unlike `shareWeek` this is a remembered
   * position rather than a permission: the switch is still on screen beside
   * the photo it governs, and nothing uploads without her passing it.
   */
  sharePhotos?: boolean;
  /**
   * When in the day she can train, as routine anchors rather than clock times.
   * Routine-anchored cues form habits faster than time-based ones and survive a
   * week that moves.
   *
   * A list, not one value, and an empty list is a real answer. Plenty of people
   * genuinely train whenever the day allows, and the research is clear that
   * rigid plans break when circumstances change — forcing a single slot on
   * someone whose week moves produces a plan they fail rather than a habit they
   * keep. `undefined` means not asked yet; `[]` means it varies.
   */
  anchors?: Anchor[];
  /**
   * Minutes from midnight. Only set when someone genuinely has a fixed slot and
   * chose one; otherwise the anchor supplies an hour for the calendar reminder.
   */
  trainingMinute?: number;
  /**
   * A Spotify playlist the user already has, launched when a workout starts.
   *
   * Stored as the bare playlist id rather than whichever of the four URL shapes
   * Spotify handed us, so the value is the same whether it was pasted from the
   * app, the web player, a share sheet or a `spotify:` URI.
   *
   * Optional and it stays optional: the app is fully usable with no music, no
   * account and no network, and starting a workout must never wait on any of
   * the three.
   */
  playlistId?: string;
  /** What to call it on screen. Free text — we cannot read their library. */
  playlistName?: string;
  /** How long to rest between sets, chosen at signup. Scales restSeconds. */
  restPref?: RestPref;
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

/**
 * A month's target, regenerated when the month turns. Replaces the 2023
 * leaderboard: something to be behind or ahead of that is not another person.
 */
export interface Challenge {
  /** YYYY-MM the target belongs to. */
  month: string;
  target: number;
}

export interface AppState {
  profile: Profile | null;
  routines: Routine[];
  sessions: Session[];
  goal: Goal | null;
  /** Set once the user has declined to set a goal, so we stop asking. */
  goalDismissed?: boolean;
  challenge?: Challenge;
  /** Dated body-weight entries, oldest first. */
  weighIns?: WeighIn[];
  /** Lifts somebody added that the library does not have. */
  customExercises?: Exercise[];
  /**
   * The user's own version of each named day type, keyed by template id. Once
   * they shape a "Leg day", pressing Leg day again brings back theirs, not the
   * generated default. Full-body is deliberately excluded: it alternates.
   */
  dayLibrary?: Record<string, PlannedExercise[]>;
}
