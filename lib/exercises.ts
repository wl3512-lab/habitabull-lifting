import type { Exercise } from "./types";

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
    id: "plank", name: "Plank", equipment: "bodyweight", primary: "core", increment: 0, compound: false,
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
];

export const byId = (id: string) => EXERCISES.find((e) => e.id === id);

export const nameOf = (id: string) => byId(id)?.name ?? id;
