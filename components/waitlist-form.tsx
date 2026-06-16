"use client";

import { useState } from "react";
import { isValidEmail } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const message =
    status === "success"
      ? "You're on the list. We'll signal you."
      : status === "error"
        ? "That email looks scrambled — try again."
        : "";

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
      className="mx-auto w-full max-w-5xl scroll-mt-24 px-5 py-20"
    >
      <div className="rounded-2xl border border-white/10 bg-black/40 p-7 sm:p-10">
        <p className="hud text-xs text-signal">[ early access ]</p>
        <h2 className="mt-3 font-mono text-2xl font-bold sm:text-3xl">
          Get in before the lights come up.
        </h2>
        <p className="mt-2 max-w-md text-muted">
          We&apos;ll signal you when CutScene opens. No spam, just the drop.
        </p>

        {status === "success" ? (
          <p
            aria-live="polite"
            className="hud mt-6 text-sm text-signal"
          >
            ✓ {message}
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            noValidate
          >
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="flex-1 rounded-lg border border-white/15 bg-black/50 px-4 py-4 font-mono text-ink placeholder:text-muted/60 focus:border-signal"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="hud rounded-lg border border-signal/60 bg-signal/10 px-6 py-4 text-sm text-signal transition-colors hover:bg-signal/20 active:scale-[0.99] disabled:opacity-50"
            >
              {status === "submitting" ? "Sending…" : "Join waitlist"}
            </button>
          </form>
        )}

        {/* Status announced politely; the value scramble is never aria-live. */}
        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">
          {status === "error" ? message : ""}
        </p>
      </div>
    </section>
  );
}
