import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
