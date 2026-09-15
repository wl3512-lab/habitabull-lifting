import Bull, { BULL } from "./Bull";

/**
 * The half second before the app knows anything.
 *
 * Reading localStorage is fast, but it cannot happen until the browser has
 * parsed and run the bundle, and on a cold launch from the home screen that is
 * long enough to see. What filled it was an empty div, so the first thing the
 * app ever showed anybody was nothing: a blank charcoal rectangle, which reads
 * as a page that failed rather than one that is arriving.
 *
 * So it shows the one thing that is true before any of her data has loaded,
 * which is whose app this is.
 *
 * Deliberately still. This is not a spinner and must not become one: a spinner
 * measures a wait and invites you to watch it, and the honest length of this
 * wait is "gone before you read this". The mark fades up over 220ms and that is
 * the whole of it, so on a fast launch it is a flicker of brand rather than a
 * loading screen that had to finish.
 */
export default function Booting() {
  return (
    <main
      className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center px-6"
      aria-busy="true"
      aria-label="Opening HabitaBull"
    >
      <div className="flood">
        <Bull size={BULL.companion} />
      </div>
    </main>
  );
}
