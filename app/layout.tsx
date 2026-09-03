import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

/*
  Two faces, one family. Barlow Condensed carries headlines and every figure
  big enough to read at arm's length; Barlow carries everything you actually
  read. Keeping them in one superfamily is what stops the condensed headline
  from looking borrowed — same skeleton, same terminals, different width.
*/
// 500 as well as 700: the Figma sets "Welcome to" and the coach screen's form
// cue in Condensed Medium, which reads as a spoken aside rather than a heading.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HabitaBull Lifting",
  description: "Most people quit by week three. This one is built for coming back.",
  applicationName: "HabitaBull Lifting",
  // The Crew screen sends a link to invite somebody; without this it previewed
  // as nothing at all, which is a poor first impression of a product whose
  // whole pitch is that it takes you seriously.
  openGraph: {
    title: "HabitaBull Lifting",
    description: "Most people quit by week three. This one is built for coming back.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  // Home-screen install: full screen, no browser chrome over the thumb zone,
  // and — the real reason — storage that iOS will not evict after seven idle
  // days. See app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: "HabitaBull Lifting",
    // "default", not "black-translucent": translucent puts the web view under
    // the status bar, and every screen here carries a fixed top padding rather
    // than a safe-area inset. Let iOS keep the clock out of the headline.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Next emits the standardised `mobile-web-app-capable`. iOS before 16.4 only
  // understood the apple-prefixed spelling, and it costs one tag to keep those
  // phones installing full-screen instead of into a Safari shell.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#16181d",
  width: "device-width",
  initialScale: 1,
  // Deliberately no maximumScale. Locking zoom on a fixed layout is tempting
  // and it is a WCAG 1.4.4 failure — someone who needs to magnify a weight
  // mid-set must be able to.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${barlow.variable} h-full antialiased`}
    >
      {/*
        This is a phone app. There is no desktop layout and there is no tablet
        layout — past the width where a viewport stops being a phone, the app
        stops growing and sits inside one instead.

        390 × 844 exactly, which is the Figma artboard and an iPhone 14/15/16
        point size. Not a max-width that stretches to fill: a stretched column
        renders the type ramp and the 18px card padding at a scale they were
        never drawn for, and that is the thing that makes a phone app read as a
        website. If the window is too short for 844, the surround scrolls. The
        device never resizes, so the design is always seen at the size it was
        drawn at.
      */}
      <body className="bg-ground desk:grid desk:min-h-dvh desk:place-items-center desk:overflow-auto desk:bg-deep desk:p-8">
        {/*
          `relative` and the id are the anchor for anything that covers the
          whole app — a dialog fixed to the viewport would spill out of the
          device on a desktop and undo the one rule this layout exists to keep.
        */}
        <div
          id="device"
          className="relative flex min-h-dvh w-full flex-col bg-ground desk:h-[844px] desk:min-h-0 desk:w-[390px] desk:shrink-0 desk:overflow-hidden desk:rounded-[44px] desk:shadow-[0_0_0_1px_var(--color-line),0_40px_80px_-20px_rgb(0_0_0/0.7)]"
        >
          {/* Scrolls inside the device on desktop; the page itself scrolls on a phone. */}
          <div id="app-scroll" className="flex flex-1 flex-col desk:overflow-y-auto desk:no-scrollbar">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
