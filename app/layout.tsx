import type { Metadata, Viewport } from "next";
import "./globals.css";
import { zodiak, generalSans } from "./fonts";
import { MotionProvider } from "@/components/motion-provider";

export const metadata: Metadata = {
  title: "CutScene — every great meme is borrowing a movie's timing",
  description:
    "CutScene decodes why a meme is funny, writes a fresh on-beat caption, and matches the comedic movie moment that makes it land — plus a legal way to produce it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14110b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${zodiak.variable} ${generalSans.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
