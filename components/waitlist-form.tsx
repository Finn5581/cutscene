"use client";

import { useState } from "react";
import { isValidEmail } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      id="waitlist"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-24 sm:px-10"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal">
        [ early access ]
      </p>
      <h2
        className="mt-6 max-w-3xl font-mono font-bold leading-[0.95] tracking-[-0.03em]"
        style={{ fontSize: "clamp(2rem, 6vw, 4rem)" }}
      >
        <span className="text-ink">GET IN BEFORE THE </span>
        <span className="text-signal">LIGHTS</span>
        <span className="text-ink"> COME UP.</span>
      </h2>
      <p className="mt-4 max-w-md text-muted">
        We&apos;ll signal you when CutScene opens. No spam, just the drop.
      </p>

      {/* Terminal prompt — the email line reads like a console input, not a boxed form */}
      <div className="mt-10 max-w-2xl">
        {status === "success" ? (
          <p
            aria-live="polite"
            className="border border-signal/40 bg-signal/5 px-4 py-5 font-mono text-sm text-signal"
          >
            ✓ You&apos;re on the list. We&apos;ll signal you.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="flex items-center gap-3 border-b border-white/15 py-3 transition-colors focus-within:border-signal"
          >
            <span aria-hidden className="font-mono text-signal">
              &gt;
            </span>
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="enter email to join_"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="flex-1 bg-transparent font-mono text-ink placeholder:text-muted/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="term-action px-4 py-2 text-[11px] text-signal disabled:opacity-50"
            >
              {status === "submitting" ? "Sending…" : "Enter"}
            </button>
          </form>
        )}

        <p aria-live="polite" className="mt-3 min-h-5 font-mono text-xs text-muted">
          {status === "error" ? "That email looks scrambled — try again." : ""}
        </p>
      </div>
    </section>
  );
}
