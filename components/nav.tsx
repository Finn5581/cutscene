"use client";

export function Nav() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
      <a
        href="#top"
        className="font-display text-2xl font-bold tracking-tight text-ink"
        aria-label="CutScene home"
      >
        CutScene
      </a>
      <nav className="flex items-center gap-7">
        <a
          href="#how"
          className="link-underline hidden text-sm text-muted transition-colors hover:text-ink sm:inline"
        >
          How it works
        </a>
        <a
          href="#waitlist"
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-[#1a1306] transition-transform hover:scale-[1.03]"
        >
          Early access
        </a>
      </nav>
    </header>
  );
}
