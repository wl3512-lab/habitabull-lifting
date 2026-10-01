"use client";

/**
 * Asked once, on her first barbell lift, with the bar in front of her.
 *
 * Onboarding is two screens on purpose and this is not one of them: somebody
 * who has never loaded a bar has nothing to choose between at signup. Here
 * there is a bar, a number and a reason to care. Either answer is the answer,
 * and the switch in Profile is where she changes her mind.
 *
 * Both buttons are outlined. "Log set" is the one orange action on this screen.
 */
export default function PlatesOffer({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  return (
    <section aria-label="Load the bar" className="mb-3 rounded-2xl bg-card p-[18px]">
      <p className="head text-emphasis text-fg">This one&apos;s on a barbell</p>
      <p className="mt-1 text-body leading-snug text-dim">
        Want to tap plates onto the bar instead of typing the total? The app does the adding.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className="head min-h-11 flex-1 rounded-full border border-line-strong px-3 text-body text-cyan transition-colors hover:border-fg"
        >
          Try it
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className="head min-h-11 flex-1 rounded-full border border-line-strong px-3 text-body text-dim transition-colors hover:border-fg hover:text-fg"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}
