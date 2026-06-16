"use client";

export function Nav() {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <a
        href="#top"
        className="font-mono text-base font-bold tracking-tight text-ink"
        aria-label="CutScene home"
      >
        CUTSCENE<span className="text-signal">_</span>
      </a>
      <nav className="flex items-center gap-6">
        <a
          href="#how"
          className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-ink sm:inline"
        >
          How it works
        </a>
        <a
          href="#waitlist"
          className="term-action px-3.5 py-2 text-[11px] text-signal"
        >
          Get early access
        </a>
      </nav>
    </header>
  );
}
