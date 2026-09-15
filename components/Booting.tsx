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
 * So it shows the two things that are true before any of her data has loaded:
 * whose app this is, and that it is on its way.
 *
 * All of it is CSS, and that is load-bearing rather than tidy. This renders in
 * the static HTML, so it is painting while the bundle this screen exists to
 * cover is still being parsed. An animation that needed React to start would
 * start at exactly the moment there was no longer anything to wait for.
 *
 * The motion is described in `globals.css` under `.boot-mark`: an arrival, and
 * then a breath if the arrival was not enough. Not a spinner, and the comment
 * there is the argument for why.
 */
export default function Booting() {
  return (
    <main
      className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center px-6"
      aria-busy="true"
      aria-label="Opening HabitaBull"
    >
      <div className="boot-mark">
        <Bull size={BULL.hero} />
      </div>
      {/*
        The camel case is the identity, not a styling accident. Same wordmark
        as the welcome screen, a step down the ramp: on the welcome screen the
        name is the headline, here it is standing under a picture.
      */}
      <p className="statement boot-name mt-5 text-title text-fg">HabitaBull</p>
    </main>
  );
}
