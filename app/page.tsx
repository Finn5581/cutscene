import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <main id="top">
      <Nav />
      <Hero />
      <HowItWorks />
      <WaitlistForm />
      <footer className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-10">
        <div className="rule flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg font-bold text-ink">
            CutScene<span className="text-gold">.</span>
          </p>
          <p className="max-w-md text-sm leading-relaxed text-faint">
            CutScene analyzes and recommends. It never hosts, streams, or downloads
            copyrighted clips. © 2026 · cutscene.io
          </p>
        </div>
      </footer>
    </main>
  );
}
