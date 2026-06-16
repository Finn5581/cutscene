import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <main id="top" className="relative">
      <Nav />
      <Hero />
      <HowItWorks />
      <WaitlistForm />
      <footer className="mx-auto w-full max-w-5xl px-5 pb-12">
        <p className="hud text-[10px] leading-relaxed text-muted/70">
          CutScene analyzes and recommends. It never hosts, streams, or downloads
          copyrighted clips — every scene match comes with a legal way to produce it.
        </p>
        <p className="mt-3 font-mono text-xs text-muted/50">
          © 2026 CutScene · cutscene.io
        </p>
      </footer>
    </main>
  );
}
