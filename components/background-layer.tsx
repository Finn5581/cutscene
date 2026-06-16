/**
 * Fixed, non-interactive backdrop: phosphor bloom + baked grain + scanlines.
 * Server component — ships zero JS. All texture is static (no live filters).
 */
export function BackgroundLayer() {
  return (
    <div
      aria-hidden
      className="scanlines pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* phosphor bloom behind the hero */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% -5%, rgba(57,255,122,0.06), transparent 70%)",
        }}
      />
      {/* baked film grain (never a live feTurbulence) */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: "url(/noise.png)", backgroundRepeat: "repeat" }}
      />
    </div>
  );
}
