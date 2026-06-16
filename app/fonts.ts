import localFont from "next/font/local";

/** Zodiak — high-contrast Didone display (Fontshare, self-hosted). Film-poster headlines. */
export const zodiak = localFont({
  src: [
    { path: "./fonts/Zodiak-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Zodiak-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-zodiak",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

/** General Sans — clean neo-grotesque (Fontshare, self-hosted). Body + UI. */
export const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-general",
  display: "swap",
  fallback: ["system-ui", "Helvetica", "Arial", "sans-serif"],
});
