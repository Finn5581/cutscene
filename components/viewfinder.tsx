/**
 * Fixed viewfinder HUD — frames the whole page like an editing monitor.
 * Corner brackets + a static timecode + a vertical side slug. Pure chrome:
 * non-interactive, decorative, ships zero JS. This is the device that makes
 * the product feel like a film-cutting console rather than a templated site.
 */
export function Viewfinder() {
  const corner = "absolute h-5 w-5 border-signal/30";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
      {/* corner brackets, inset from the edges */}
      <span className={`${corner} left-3 top-3 border-l border-t`} />
      <span className={`${corner} right-3 top-3 border-r border-t`} />
      <span className={`${corner} bottom-3 left-3 border-b border-l`} />
      <span className={`${corner} bottom-3 right-3 border-b border-r`} />

      {/* timecode — bottom-left, the film/forensic tell */}
      <div className="absolute bottom-3.5 left-9 hidden items-center gap-2 font-mono text-[10px] tracking-widest text-muted/60 sm:flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal/80" />
        REC · 01:42:18:04
      </div>

      {/* vertical slug — right edge */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 rotate-90 font-mono text-[10px] tracking-[0.4em] text-muted/40 lg:block">
        CUTSCENE // MEME-INTELLIGENCE
      </div>
    </div>
  );
}
