import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chrome Hearts Miami slot alerts",
  description: "Get a text the moment a Chrome Hearts Miami appointment opens up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
