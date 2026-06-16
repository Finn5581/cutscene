"use client";

export function Nav() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
      <a
        href="#top"
        className="font-mono text-lg font-bold tracking-tight text-ink"
        aria-label="CutScene home"
      >
        CUTSCENE<span className="text-signal">_</span>
      </a>
      <nav className="flex items-center gap-5">
        <a
          href="#how"
          className="hud hidden text-xs text-muted transition-colors hover:text-ink sm:inline"
        >
          How it works
        </a>
        <a
          href="#waitlist"
          className="hud rounded-md border border-signal/50 bg-signal/10 px-3.5 py-2 text-xs text-signal transition-colors hover:bg-signal/20"
        >
          Get early access
        </a>
      </nav>
    </header>
  );
}
