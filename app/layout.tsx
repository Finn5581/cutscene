import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BackgroundLayer } from "@/components/background-layer";

export const metadata: Metadata = {
  title: "CutScene — X-ray vision for memes",
  description:
    "Decode why a meme is funny, write a fresh on-beat caption, and match the comedic movie moment that makes it land. Plus a legal way to produce it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070708",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh">
        <BackgroundLayer />
        {children}
      </body>
    </html>
  );
}
