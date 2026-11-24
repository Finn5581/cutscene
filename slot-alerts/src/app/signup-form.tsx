"use client";
import { useActionState } from "react";
import { signup, type SignupState } from "./actions";
import { DAYS, WINDOWS } from "@/lib/prefs";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, null);

  if (state?.ok) return <p className="success">{state.message}</p>;
  const v = state?.values;

  return (
    // `key` remounts the form after each attempt so the defaults below refill it.
    <form action={action} key={JSON.stringify(v ?? null)}>
      <label htmlFor="name">Full name (as on your photo ID)</label>
      <input id="name" name="name" type="text" autoComplete="name" defaultValue={v?.name} required />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" defaultValue={v?.email} required />

      <label htmlFor="phone">Mobile number</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(305) 555-0123" defaultValue={v?.phone} required />

      <fieldset>
        <legend>Days that work</legend>
        <div className="chips">
          {DAYS.map((d) => (
            <label key={d.id} className="chip">
              <input type="checkbox" name="days" value={d.id} defaultChecked={v ? v.days.includes(d.id) : true} /> {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Times that work (Miami time)</legend>
        <div className="chips">
          {WINDOWS.map((w) => (
            <label key={w.id} className="chip">
              <input type="checkbox" name="windows" value={w.id} defaultChecked={v ? v.windows.includes(w.id) : true} /> {w.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Honeypot field, hidden from people. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <label className="consent" style={{ marginTop: 20 }}>
        <input type="checkbox" name="sms_consent" defaultChecked={v?.consent} required />
        <span>
          I agree to receive automated text messages and emails about open appointments at this number and email.
          Up to 5 alerts a day. Msg &amp; data rates may apply. Reply STOP at any time to unsubscribe, HELP for help.
          Consent is not a condition of purchase.
        </span>
      </label>

      <div style={{ marginTop: 20 }}>
        <button type="submit" disabled={pending}>{pending ? "Signing up…" : "Get alerts"}</button>
      </div>
      {state && !state.ok && <p className="error" role="alert">{state.message}</p>}
    </form>
  );
}
