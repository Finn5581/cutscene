import { Viewfinder } from "@/components/viewfinder";
import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <>
      <Viewfinder />
      <main id="top" className="relative">
        <Nav />
        <Hero />
        <HowItWorks />
        <WaitlistForm />
        <footer className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-10">
          <div className="rule flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted/50">
              © 2026 CutScene · cutscene.io
            </p>
            <p className="max-w-md font-mono text-[10px] leading-relaxed text-muted/50">
              CutScene analyzes and recommends. It never hosts, streams, or downloads
              copyrighted clips.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
