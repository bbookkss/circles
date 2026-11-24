import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";
import ViewerTimezone from "@/components/ViewerTimezone";
import InstallHint from "@/components/InstallHint";

/**
 * One family for everything: Host Grotesk. Big headings at weight 300 with
 * tight tracking, body at 400, emphasis at 500. Numbers use tabular figures
 * (set on <html> in globals.css) instead of a monospace face.
 *
 * This replaced Fraunces + Figtree + Space Mono on 2026-11-18. A soft serif
 * with an italic accent word over a mono label is the most common look of a
 * generated site, and it was why the app read as one. See docs/design/.
 */
const host = Host_Grotesk({
  variable: "--font-host",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Circles · groups that meet every week",
  description:
    "Nobody makes a friend at a one-off. Circles are local groups that meet on a schedule, close enough to walk to. See who is coming before you go.",
  applicationName: "Circles",
  // Added to an iPhone home screen, open full screen with no Safari bar.
  // black-translucent: the app draws under the status bar instead of iOS
  // painting it white (a white strip in dark mode). TopNav puts a band
  // behind the clock and every page is pushed down by the safe area.
  appleWebApp: { capable: true, title: "Circles", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // Lets content use the full screen; the nav, tab bar and sheets already
  // pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#252b34" },
  ],
};

/**
 * Light or dark before first paint, so the page never flashes the wrong one.
 * Follows the system until the person picks with the toggle in the nav; the
 * choice is kept in localStorage as "circles-theme".
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("circles-theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${host.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* The installed iPhone app draws under the status bar
            (black-translucent). This band sits behind the clock on every
            page: ink in light mode so the white clock reads, page colour in
            dark. Zero height in a browser. */}
        <div aria-hidden className="fixed top-0 inset-x-0 z-[80] h-[env(safe-area-inset-top)] bg-[#1a2230] dark:bg-background pointer-events-none" />
        <ViewerTimezone />
        {children}
        <InstallHint />
      </body>
    </html>
  );
}
