import type { Equipment, Exercise, Muscle } from "./types";

/**
 * Deliberately small. The deck's tutorial slide lists back squat, deadlift and
 * goblet squat by name, so those are anchors. Every entry carries a form cue,
 * ordered steps and the mistakes people actually make, because "no guidance for
 * beginners on form, pacing, or rest" was a top-six interview finding.
 *
 * Mistakes are written as observations, never as scolding. Someone reading this
 * mid-set is already unsure; the tone has to stay on their side.
 */
export const EXERCISES: Exercise[] = [
  {
    id: "back-squat", name: "Back Squat", equipment: "barbell", primary: "quads", increment: 2.5, compound: true,
    // Cue and mistakes as written on the 2026 coach screen, which took the
    // mistakes straight from the deck's tutorial (p38). The original wrote the
    // third one as knees collapsing "forward"; knees collapse medially, so it
    // is stated as inward here.
    cue: "Knees caving in? Push them out toward your little toes.",
    steps: [
      "Brace, then break at the hips and knees together",
      "Thighs to parallel, knees tracking over the toes",
      "Drive the floor away, hips and chest rise together",
    ],
    mistakes: [
      "Leaning too far forward",
      "Not squatting low enough",
      "Letting the knees collapse inward",
    ],
  },
  {
    id: "goblet-squat", name: "Goblet Squat", equipment: "dumbbell", primary: "quads", increment: 2.5, compound: true,
    cue: "Elbows inside the knees at the bottom. Chest tall.",
    steps: [
      "Hold one dumbbell vertically against your chest, both hands under the top plate.",
      "Feet shoulder width, toes slightly out.",
      "Sit straight down, elbows tracking inside the knees.",
      "Stand up without letting the dumbbell drift away from your chest.",
    ],
    mistakes: ["Leaning forward so the weight pulls you over.", "Stopping short — go until the hip is below the knee."],
  },
  {
    id: "bodyweight-squat", name: "Bodyweight Squat", equipment: "bodyweight", primary: "quads", increment: 0, compound: true,
    cue: "Slow down on the way down. Three seconds.",
    steps: [
      "Feet shoulder width, arms out in front for balance.",
      "Lower for a count of three, hips back and down.",
      "Pause for a beat at the bottom.",
      "Stand up at normal speed.",
    ],
    mistakes: ["Rushing the descent, which is where the work is.", "Rounding the lower back at the bottom."],
  },
  {
    id: "deadlift", name: "Deadlift", equipment: "barbell", primary: "hamstrings", increment: 2.5, compound: true, heavy: true,
    cue: "Bar stays against your legs. Push the floor away.",
    steps: [
      "Bar over mid-foot, about an inch from your shins. Feet hip width.",
      "Hinge down and grip just outside your legs. Chest up, back flat.",
      "Pull the slack out of the bar, then push the floor away with your legs.",
      "Stand tall, then lower it the same way it came up.",
    ],
    mistakes: ["Hips shooting up first, turning it into a back lift.", "Letting the bar swing out away from the shins."],
  },
  {
    id: "romanian-deadlift", name: "Romanian Deadlift", equipment: "dumbbell", primary: "hamstrings", increment: 2.5, compound: true,
    cue: "Hinge at the hip, soft knees. Feel it in the hamstring.",
    steps: [
      "Stand with a dumbbell in each hand, in front of your thighs.",
      "Knees soft and fixed — they do not bend further from here.",
      "Push your hips back, letting the weights slide down your legs.",
      "Stop when the hamstrings are stretched, then drive the hips forward.",
    ],
    mistakes: ["Turning it into a squat by bending the knees.", "Going past your range and rounding the back."],
  },
  {
    id: "hip-thrust", name: "Hip Thrust", equipment: "barbell", primary: "glutes", increment: 2.5, compound: false,
    cue: "Ribs down, chin tucked. Squeeze at the top.",
    steps: [
      "Shoulder blades on a bench, bar padded across the hips, feet flat.",
      "Tuck the chin and look at your knees.",
      "Drive through the heels until hips, knees and shoulders line up.",
      "Squeeze for a count of one, then lower under control.",
    ],
    mistakes: ["Over-arching the lower back at the top instead of squeezing the glutes.", "Feet too far out, so the hamstrings take over."],
  },
  {
    id: "glute-bridge", name: "Glute Bridge", equipment: "bodyweight", primary: "glutes", increment: 0, compound: false,
    cue: "Push through the heels. Pause for one count.",
    steps: [
      "Lie on your back, knees bent, heels close to your hips.",
      "Press the lower back into the floor.",
      "Push through the heels and lift the hips until your body is a straight line.",
      "Pause one count, lower without resting on the floor.",
    ],
    mistakes: ["Pushing through the toes.", "Arching the back to get higher."],
  },
  {
    id: "bench-press", name: "Bench Press", equipment: "barbell", primary: "chest", increment: 2.5, compound: true,
    cue: "Shoulder blades pinned. Bar to the lower chest.",
    steps: [
      "Eyes under the bar, feet flat, shoulder blades pinched down and back.",
      "Grip so your forearms are vertical at the bottom.",
      "Unrack, lower to the lower chest with the elbows at about 45 degrees.",
      "Touch, then press back over the shoulders.",
    ],
    mistakes: ["Elbows flared straight out to the sides.", "Bouncing the bar off the chest."],
  },
  {
    id: "db-bench", name: "Dumbbell Bench Press", equipment: "dumbbell", primary: "chest", increment: 2.5, compound: true,
    cue: "Wrists stacked over elbows. Control the lowering.",
    steps: [
      "Sit with the dumbbells on your thighs, then lie back and kick them into place.",
      "Start with arms extended, weights over the chest.",
      "Lower until your elbows are level with the bench.",
      "Press up and slightly in, without clanging the weights together.",
    ],
    mistakes: ["Letting the wrists bend back under the load.", "Cutting the range short at the bottom."],
  },
  {
    id: "push-up", name: "Push-up", equipment: "bodyweight", primary: "chest", increment: 0, compound: true,
    cue: "Body in one line. Elbows at 45 degrees, not flared.",
    steps: [
      "Hands just outside the shoulders, body in one straight line.",
      "Squeeze the glutes and stomach so the hips do not sag.",
      "Lower until the chest is a fist off the floor.",
      "Press back up, keeping the line.",
    ],
    mistakes: ["Hips sagging or piking up.", "Only going halfway down."],
  },
  {
    id: "barbell-row", name: "Barbell Row", equipment: "barbell", primary: "back", increment: 2.5, compound: true,
    cue: "Hinge to about 45 degrees. Pull to the belly button.",
    steps: [
      "Hinge forward to about 45 degrees, back flat, bar hanging at arm's length.",
      "Pull the bar toward your belly button, leading with the elbows.",
      "Squeeze the shoulder blades together for a beat.",
      "Lower under control without standing up.",
    ],
    mistakes: ["Standing up a little on every rep to help the weight.", "Pulling to the chest instead of the belly."],
  },
  {
    id: "db-row", name: "Dumbbell Row", equipment: "dumbbell", primary: "back", increment: 2.5, compound: true,
    cue: "Flat back. Drive the elbow past your ribs.",
    steps: [
      "One hand and knee on a bench, other foot on the floor, back flat.",
      "Let the dumbbell hang straight down.",
      "Drive the elbow up past your ribs, keeping it close to your side.",
      "Lower all the way until the arm is straight.",
    ],
    mistakes: ["Twisting the torso to lift more.", "Shrugging instead of rowing."],
  },
  {
    id: "lat-pulldown", name: "Lat Pulldown", equipment: "machine", primary: "back", increment: 2.5, compound: true,
    cue: "Lead with the elbows, not the hands.",
    steps: [
      "Set the thigh pad so you stay seated. Grip a little wider than the shoulders.",
      "Lean back slightly and hold that angle.",
      "Pull the bar to the top of your chest, elbows driving down.",
      "Let it rise all the way back up under control.",
    ],
    mistakes: ["Rocking back and forth to move the stack.", "Pulling the bar behind your neck."],
  },
  {
    id: "inverted-row", name: "Inverted Row", equipment: "bodyweight", primary: "back", increment: 0, compound: true,
    cue: "Straight line from heels to head. Squeeze at the top.",
    steps: [
      "Set a bar at about hip height. Hang underneath it, hands shoulder width.",
      "Heels on the floor, body in one straight line.",
      "Pull your chest to the bar, elbows tight to the body.",
      "Lower until the arms are straight, keeping the line.",
    ],
    mistakes: ["Hips dropping as you tire.", "Stopping before the chest reaches the bar."],
  },
  {
    id: "overhead-press", name: "Overhead Press", equipment: "barbell", primary: "shoulders", increment: 2.5, compound: true,
    cue: "Squeeze the glutes so you don't lean back.",
    steps: [
      "Bar on the front of the shoulders, hands just outside shoulder width.",
      "Squeeze the glutes and stomach so the ribs stay down.",
      "Press straight up, moving your head back out of the way.",
      "Finish with the bar over the middle of your feet, arms locked.",
    ],
    mistakes: ["Leaning back to turn it into an incline press.", "Pressing around the head instead of moving the head."],
  },
  {
    id: "db-shoulder-press", name: "Dumbbell Shoulder Press", equipment: "dumbbell", primary: "shoulders", increment: 2.5, compound: true,
    cue: "Press slightly forward of your ears, not behind.",
    steps: [
      "Dumbbells at shoulder height, palms facing forward.",
      "Ribs down, stomach braced.",
      "Press up until the arms are straight, weights just in front of your ears.",
      "Lower until the elbows are level with the shoulders.",
    ],
    mistakes: ["Flaring the elbows straight out to the sides.", "Arching the lower back on the last few reps."],
  },
  {
    id: "pike-push-up", name: "Pike Push-up", equipment: "bodyweight", primary: "shoulders", increment: 0, compound: true,
    cue: "Hips high. Crown of the head toward the floor.",
    steps: [
      "Start in a push-up position, then walk your feet in so the hips are high.",
      "Hands shoulder width, head between the arms.",
      "Lower the crown of your head toward the floor.",
      "Press back up to the start.",
    ],
    mistakes: ["Hips dropping so it becomes a push-up.", "Lowering the face forward instead of the crown down."],
  },
  {
    id: "db-curl", name: "Dumbbell Curl", equipment: "dumbbell", primary: "arms", increment: 2.5, compound: false,
    cue: "Elbows stay at your sides. No swinging.",
    steps: [
      "Stand tall, dumbbells at your sides, palms forward.",
      "Elbows pinned to your ribs.",
      "Curl up without letting the elbows drift forward.",
      "Lower all the way down, slower than you lifted.",
    ],
    mistakes: ["Swinging the torso to start the rep.", "Stopping halfway down."],
  },
  {
    id: "tricep-pushdown", name: "Tricep Pushdown", equipment: "machine", primary: "arms", increment: 2.5, compound: false,
    cue: "Upper arms locked in place. Only the forearm moves.",
    steps: [
      "Set the cable at chest height or above. Grip with elbows at your sides.",
      "Lean forward a few degrees and hold still.",
      "Straighten the arms fully, only the forearms moving.",
      "Let it come back up until the forearms are past parallel.",
    ],
    mistakes: ["Elbows drifting forward and back.", "Leaning your bodyweight onto the bar."],
  },
  {
    id: "plank", name: "Plank", equipment: "bodyweight", primary: "core", increment: 0, compound: false, hold: true,
    cue: "Squeeze everything. Reps here are seconds.",
    steps: [
      "Elbows under the shoulders, forearms on the floor.",
      "Body in one line from heels to head, eyes down.",
      "Squeeze the glutes and pull the belly button in.",
      "Breathe normally and hold. Reps here are seconds.",
    ],
    mistakes: ["Hips sagging toward the floor.", "Holding your breath the whole time."],
  },
  {
    id: "kb-swing", name: "Kettlebell Swing", equipment: "kettlebell", primary: "glutes", increment: 2.5, compound: true,
    cue: "It's a hinge, not a squat. The hips throw it.",
    steps: [
      "Kettlebell a foot in front of you. Hinge and grab it with both hands.",
      "Hike it back between your legs like a football snap.",
      "Snap the hips forward hard — the bell floats up on its own.",
      "Let it swing back down and go straight into the next rep.",
    ],
    mistakes: ["Squatting the bell up instead of hinging.", "Lifting it with the arms and shoulders."],
  },
  // ── Machines and dumbbells ────────────────────────────────────────────────
  //
  // The library was barbell-first, which left two holes. Core had exactly one
  // entry, so "Pick a core lift" offered a single plank and, once that plank
  // was already in the day, nothing at all. And a gym-goer whose kit is
  // machines and dumbbells — the most common way anyone actually trains, and
  // the least intimidating way to start — could not fill a week.
  //
  // Everything loaded moves in 2.5, machines included, matching the two that
  // were already here. Some pin stacks only step in 5s and need an add-on
  // magnet for the half — but one progression step across the whole app is
  // worth more than being right about plate sizes, and "up 2.5" is the rule
  // the rest of the product states.
  {
    id: "ab-crunch-machine", name: "Ab Crunch Machine", equipment: "machine", primary: "core", increment: 2.5, compound: false,
    cue: "Pull with your ribs, not your arms. The handles just come along.",
    steps: [
      "Set the seat so the pad sits on your chest, not your throat.",
      "Grip the handles lightly and put your feet under the rollers.",
      "Curl your ribs down toward your hips — a short range, not a bend at the waist.",
      "Let it back up under control until you feel the stretch, and go again.",
    ],
    mistakes: ["Hauling on the handles with the arms.", "Going for a huge range; the abs move a short distance."],
  },
  {
    id: "ab-slider", name: "Sliding Ab Trainer", equipment: "machine", primary: "core", increment: 0, compound: false,
    cue: "Push the floor away and let the hips travel last.",
    steps: [
      "Kneel on the pad and take the handles on the rail.",
      "Brace as if you are about to be poked in the stomach.",
      "Slide out only as far as you can keep your back flat.",
      "Pull yourself back with your stomach, not your arms.",
    ],
    mistakes: ["Sliding out past the point where the lower back arches.", "Letting the hips sag and the neck crane up."],
  },
  {
    id: "roman-chair-leg-raise", name: "Roman Chair Leg Raise", equipment: "machine", primary: "core", increment: 0, compound: false,
    cue: "Curl the hips up. Lifting the legs alone is mostly hip flexor.",
    steps: [
      "Forearms on the pads, back against the rest, shoulders down.",
      "Start with the legs hanging straight and still.",
      "Raise the knees and tuck the hips slightly under at the top.",
      "Lower slowly. Stopping the swing is most of the work.",
    ],
    mistakes: ["Swinging the legs up and using the bounce.", "Shrugging into the pads instead of keeping the shoulders down."],
  },
  {
    id: "back-extension", name: "Back Extension", equipment: "machine", primary: "core", increment: 2.5, compound: false,
    cue: "Hinge and rise. This is the back of the core, and it counts.",
    steps: [
      "Set the pad just below the hip bones so you can bend freely.",
      "Cross your arms on your chest and keep the chin tucked.",
      "Lower by folding at the hips with the back flat.",
      "Squeeze the glutes to come up, and stop in line with your legs.",
    ],
    mistakes: ["Arching past straight at the top.", "Rounding the back on the way down to reach further."],
  },
  {
    id: "ab-wheel", name: "Ab Wheel", equipment: "bodyweight", primary: "core", increment: 0, compound: false,
    cue: "Roll out only as far as the back stays flat. That distance grows.",
    steps: [
      "Kneel with the wheel under your shoulders.",
      "Tuck the hips under slightly and brace hard.",
      "Roll forward in a straight line, ribs pulled down.",
      "Roll back by pulling the hips toward the heels.",
    ],
    mistakes: ["Rolling out until the lower back dips.", "Bending at the hips instead of holding one line."],
  },
  {
    id: "leg-press", name: "Leg Press", equipment: "machine", primary: "quads", increment: 2.5, compound: true,
    cue: "Push through the whole foot and stop short of locking out.",
    steps: [
      "Feet on the platform about hip width, toes slightly out.",
      "Lower until the knees are near the chest, back flat on the pad.",
      "Press through the middle of the foot.",
      "Stop just before the knees lock, and go again.",
    ],
    mistakes: ["Letting the lower back lift off the pad at the bottom.", "Snapping the knees straight at the top."],
  },
  {
    id: "leg-extension", name: "Leg Extension", equipment: "machine", primary: "quads", increment: 2.5, compound: false,
    cue: "Straighten under control and pause at the top.",
    steps: [
      "Line the knee joint up with the machine's pivot.",
      "Pad on the shin just above the ankle.",
      "Straighten the legs and hold for a beat.",
      "Lower slowly rather than letting the stack drop.",
    ],
    mistakes: ["Kicking the weight up with a swing of the hips.", "Letting the stack slam down between reps."],
  },
  {
    id: "lying-leg-curl", name: "Lying Leg Curl", equipment: "machine", primary: "hamstrings", increment: 2.5, compound: false,
    cue: "Curl the heels toward your backside, hips staying down.",
    steps: [
      "Line the knees up just past the edge of the pad.",
      "Roller on the back of the ankles, hips pressed into the bench.",
      "Curl the heels up as far as they will go.",
      "Lower slowly and stop just before the weight rests.",
    ],
    mistakes: ["Lifting the hips to help the weight up.", "Cutting the range short at the bottom."],
  },
  {
    id: "dumbbell-hip-thrust", name: "Dumbbell Hip Thrust", equipment: "dumbbell", primary: "glutes", increment: 2.5, compound: false,
    cue: "Ribs down, then squeeze the glutes until the hips are level.",
    steps: [
      "Upper back on a bench, feet flat, dumbbell across the hips.",
      "Tuck the chin and keep the ribs pulled down.",
      "Drive through the heels until the body is one line from knee to shoulder.",
      "Lower under control without resting the hips down.",
    ],
    mistakes: ["Arching the lower back instead of finishing with the glutes.", "Pushing off the toes rather than the heels."],
  },
  {
    id: "glute-kickback-machine", name: "Glute Kickback", equipment: "machine", primary: "glutes", increment: 2.5, compound: false,
    cue: "One leg at a time, and the working side does the work.",
    steps: [
      "Set the pad against the sole or the back of the thigh.",
      "Hold the handles and keep the hips square to the machine.",
      "Push the leg back and squeeze at the end.",
      "Return slowly, then finish all the reps before swapping sides.",
    ],
    mistakes: ["Twisting the hips to get more range.", "Arching the lower back at the end of the push."],
  },
  {
    id: "chest-press-machine", name: "Chest Press", equipment: "machine", primary: "chest", increment: 2.5, compound: true,
    cue: "Handles level with the middle of the chest, shoulders back.",
    steps: [
      "Set the seat so the handles sit at mid-chest.",
      "Shoulder blades pulled back and down against the pad.",
      "Press out until the arms are nearly straight.",
      "Come back until you feel the chest stretch, then press again.",
    ],
    mistakes: ["Letting the shoulders roll forward at the end of the press.", "Setting the seat high so the handles press down from the neck."],
  },
  {
    id: "pec-deck", name: "Pec Deck", equipment: "machine", primary: "chest", increment: 2.5, compound: false,
    cue: "Hug, do not push. The elbows travel, the hands just hold on.",
    steps: [
      "Seat set so the handles are level with the chest.",
      "A soft bend in the elbows, kept the whole way.",
      "Bring the arms together and pause where the chest is tightest.",
      "Open slowly to a stretch you can control.",
    ],
    mistakes: ["Straightening and bending the elbows to press instead of fly.", "Opening so far the shoulders take the stretch."],
  },
  {
    id: "dumbbell-fly", name: "Dumbbell Fly", equipment: "dumbbell", primary: "chest", increment: 2.5, compound: false,
    cue: "Wide arc, soft elbows, and lighter than you think.",
    steps: [
      "Lie back with the dumbbells above the chest, palms facing each other.",
      "Keep a fixed soft bend in the elbows.",
      "Open the arms out until the chest stretches.",
      "Bring them back over the chest along the same arc.",
    ],
    mistakes: ["Going heavy and turning it into a clumsy press.", "Dropping the elbows below the bench and straining the shoulder."],
  },
  {
    id: "seated-row-machine", name: "Seated Row", equipment: "machine", primary: "back", increment: 2.5, compound: true,
    cue: "Lead with the elbows and finish with the shoulder blades.",
    steps: [
      "Chest against the pad, feet planted, back straight.",
      "Take the handles with the arms long and the shoulders relaxed forward.",
      "Pull the elbows back and squeeze the shoulder blades together.",
      "Let the arms straighten fully before the next rep.",
    ],
    mistakes: ["Leaning back to move the stack.", "Shrugging the shoulders up toward the ears."],
  },
  {
    id: "shoulder-press-machine", name: "Shoulder Press", equipment: "machine", primary: "shoulders", increment: 2.5, compound: true,
    cue: "Press up, not forward, and keep the ribs down.",
    steps: [
      "Set the seat so the handles start at shoulder height.",
      "Back flat against the pad, feet on the floor.",
      "Press up until the arms are nearly straight.",
      "Lower under control back to shoulder height.",
    ],
    mistakes: ["Arching the lower back off the pad to finish the press.", "Stopping halfway down and cutting the range short."],
  },
  {
    id: "dumbbell-lateral-raise", name: "Lateral Raise", equipment: "dumbbell", primary: "shoulders", increment: 2.5, compound: false,
    cue: "Up to shoulder height, no higher, and lighter than feels right.",
    steps: [
      "Stand with the dumbbells at your sides, a soft bend in the elbows.",
      "Lift out to the sides, leading with the elbows.",
      "Stop when the arms are level with the shoulders.",
      "Lower slowly. The way down is the part that works.",
    ],
    mistakes: ["Swinging the weight up with the hips.", "Going above shoulder height and handing the work to the traps."],
  },
  {
    id: "dumbbell-hammer-curl", name: "Hammer Curl", equipment: "dumbbell", primary: "arms", increment: 2.5, compound: false,
    cue: "Palms face each other the whole way, elbows pinned.",
    steps: [
      "Stand tall with a dumbbell in each hand, thumbs forward.",
      "Keep the elbows at your sides.",
      "Curl up without turning the wrists.",
      "Lower all the way down before the next rep.",
    ],
    mistakes: ["Swinging the body to start the curl.", "Letting the elbows drift forward at the top."],
  },
  {
    id: "preacher-curl-machine", name: "Preacher Curl", equipment: "machine", primary: "arms", increment: 2.5, compound: false,
    cue: "Upper arms stay flat on the pad from first rep to last.",
    steps: [
      "Set the seat so your armpits rest at the top of the pad.",
      "Take the handles with the arms nearly straight.",
      "Curl up until the forearms are vertical.",
      "Lower slowly and straighten fully at the bottom.",
    ],
    mistakes: ["Lifting the elbows off the pad to get more range.", "Stopping short at the bottom, which is where it is hardest."],
  },
];

/**
 * Lifts somebody added themselves.
 *
 * Held in a module registry rather than threaded through every component,
 * because `byId` and `nameOf` are called from a dozen places and a custom lift
 * has to be indistinguishable from a built-in one at every single one of them.
 * Storage repopulates this on load; nothing else writes to it.
 */
let custom: Exercise[] = [];

export function setCustomExercises(list: Exercise[]) {
  custom = list;
}

/** Everything the app can offer, built-in and added. */
export const allExercises = (): Exercise[] => [...EXERCISES, ...custom];

export const isCustom = (id: string) => custom.some((e) => e.id === id);

export const byId = (id: string) =>
  EXERCISES.find((e) => e.id === id) ?? custom.find((e) => e.id === id);

export const nameOf = (id: string) => byId(id)?.name ?? id;

/**
 * Turn a typed name into a lift the rest of the app can use.
 *
 * No coaching is invented for it. Every built-in entry carries a cue, ordered
 * steps and the mistakes people actually make, and those were written by a
 * person — having a language model improvise form advice for an arbitrary
 * barbell movement is the one place in this product where being wrong could
 * hurt somebody. It says plainly that this one is theirs instead.
 */
export function makeCustomExercise(
  name: string,
  primary: Muscle,
  equipment: Equipment,
  compound: boolean
): Exercise {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    // Time alone is not unique — two lifts added in the same millisecond
    // collided, and a duplicate id would quietly make one of them unreachable.
    id: `custom-${slug || "lift"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    equipment,
    primary,
    increment: equipment === "bodyweight" ? 0 : 2.5,
    compound,
    cue: "Your lift, your form. Take the first set lighter than you think.",
    steps: [
      "This one is yours — the app has no coaching written for it.",
      "Set up the way you already know it.",
      "Start lighter than your working weight and find the groove.",
      "Stop the set while the last rep still looks like the first.",
    ],
    mistakes: [
      "Going straight to a working weight on a movement you are still learning.",
      "Chasing the number when the form has already gone.",
    ],
  };
}
