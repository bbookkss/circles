import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import AsciiField from "@/components/AsciiField";

// Primary typeface for the whole app. Swap this import + call to change the
// site font in one place (e.g. JetBrains_Mono, IBM_Plex_Mono).
const siteFont = Space_Mono({
  variable: "--font-site",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Circles · find your people",
  description: "Recurring local gatherings, mapped. Join circles near you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${siteFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Fixed, so it is a texture the page moves over rather than a
            19k-cell grid that has to grow with the document. Anything with an
            opaque background (the landing hero, the map) simply covers it.

            The bone lives on <html>, not <body>, and that is load-bearing. A
            background on body propagates to the page canvas, which paints
            below negative z-index, so this whole layer was invisible until it
            moved up. Keeping it on html also means the colour survives if
            this component never renders. */}
        <AsciiField variant="on-light" className="fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
