import type { Metadata } from "next";
import { Fraunces, Figtree, Space_Mono } from "next/font/google";
import "./globals.css";
import ViewerTimezone from "@/components/ViewerTimezone";

/**
 * Three faces, three jobs. This used to be one mono for everything, which
 * reads as a terminal and tires the eye at paragraph length.
 *
 *   Fraunces    display: circle names, day names, the greeting. Optical sizes
 *               mean the masthead and a small italic label are the same
 *               family behaving differently.
 *   Figtree     body: anything meant to be read.
 *   Space Mono  utility only: times, dates, counts, small labels. The old
 *               site face, kept for what it is actually good at.
 */
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // A variable font: weight must be "variable" for the axes to be requested.
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  weight: "variable",
});

const body = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const utility = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Circles · groups that meet every week",
  description:
    "Nobody makes a friend at a one-off. Circles are local groups that meet on a schedule, close enough to walk to. See who is coming before you go.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${utility.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ViewerTimezone />
        {children}
      </body>
    </html>
  );
}
