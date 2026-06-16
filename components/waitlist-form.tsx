"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-28 sm:px-10"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-90px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl"
      >
        <p className="kicker">Early access</p>
        <h2
          className="mt-6 font-display font-bold leading-[1.02] tracking-[-0.02em] text-ink"
          style={{ fontSize: "clamp(2.1rem, 5vw, 4rem)" }}
        >
          Get in before the lights come up.
        </h2>
        <p className="mt-5 max-w-md text-lg text-muted">
          We&apos;ll signal you when CutScene opens its doors. No spam — just the
          premiere invite.
        </p>

        {status === "success" ? (
          <p
            aria-live="polite"
            className="mt-9 border-l-2 border-[var(--line-gold)] py-1 pl-5 text-lg text-gold"
          >
            You&apos;re on the list. We&apos;ll signal you.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mt-9 flex max-w-xl flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="waitlist-email"
                className="text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted"
              >
                Email
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
                className="mt-2 w-full border-b border-[var(--line)] bg-transparent pb-3 text-lg text-ink placeholder:text-faint focus:border-gold focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={status === "submitting"}
              className="rounded-full bg-gold px-7 py-4 text-[15px] font-medium text-[#1a1306] transition-colors hover:bg-[#e6bd72] disabled:opacity-50"
            >
              {status === "submitting" ? "Sending…" : "Request access"}
            </button>
          </form>
        )}

        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">
          {status === "error" ? "That email looks off — give it another take." : ""}
        </p>
      </motion.div>
    </section>
  );
}
