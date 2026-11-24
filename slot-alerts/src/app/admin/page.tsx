/**
 * Admin dashboard: worker health, recent openings, the sign-up queue, recent alerts and polls.
 */
import { requireAdmin } from "@/lib/auth";
import { config, resendConfigured, twilioConfigured } from "@/lib/config";
import { getDb, kvGet, type Signup } from "@/lib/db";
import { describePrefs, parseList } from "@/lib/prefs";
import { formatSlot, localDay } from "@/lib/time";
import { healthSnapshot } from "@/lib/watchdog";
import { pauseSignup, removeSignup, resumeSignup, signOut } from "./actions";

export const dynamic = "force-dynamic";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: config.timezone, dateStyle: "short", timeStyle: "medium" }) : "—";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

function Status({ s }: { s: Signup }) {
  if (s.status === "active") return <span className="badge ok">waiting</span>;
  if (s.status === "paused") return <span className="badge warn">booked · paused until {fmt(s.paused_until)}</span>;
  return <span className="badge bad">unsubscribed</span>;
}

export default async function AdminPage() {
  await requireAdmin();
  const db = getDb();
  const health = healthSnapshot();
  const today = localDay();

  const signups = db
    .prepare(
      `SELECT s.*,
         (SELECT COUNT(*) FROM alerts a WHERE a.signup_id = s.id AND a.local_day = ?) AS today,
         (SELECT COUNT(*) FROM alerts a WHERE a.signup_id = s.id) AS total,
         (SELECT COUNT(*) FROM alerts a WHERE a.signup_id = s.id AND a.clicked_at IS NOT NULL) AS clicks
       FROM signups s ORDER BY s.id`,
    )
    .all(today) as unknown as (Signup & { today: number; total: number; clicks: number })[];

  const alerts = db
    .prepare(
      `SELECT a.*, s.name FROM alerts a JOIN signups s ON s.id = a.signup_id ORDER BY a.id DESC LIMIT 50`,
    )
    .all() as unknown as { id: number; name: string; slots: string; sms_status: string | null; email_status: string | null; clicked_at: string | null; created_at: string }[];

  const openings = db.prepare("SELECT * FROM openings ORDER BY id DESC LIMIT 20").all() as unknown as {
    id: number; slot: string; spots: number; seen_at: string; gone_at: string | null; alerted: number;
  }[];

  const polls = db.prepare("SELECT * FROM polls ORDER BY id DESC LIMIT 15").all() as unknown as {
    id: number; at: string; ok: number; http_status: number | null; open_count: number | null; new_count: number | null; duration_ms: number; error: string | null;
  }[];

  const pollStats = db
    .prepare("SELECT COUNT(*) AS n, SUM(ok) AS ok FROM polls WHERE at > ?")
    .get(new Date(Date.now() - 86400_000).toISOString()) as { n: number; ok: number | null };

  const currentOpen = JSON.parse(kvGet("current_open_slots") ?? "[]") as { slot: string; spots: number }[];
  const counts = { active: 0, paused: 0, unsubscribed: 0 } as Record<string, number>;
  signups.forEach((s) => counts[s.status]++);

  return (
    <div className="wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>Slot alerts admin</h1>
        <form action={signOut}><button className="secondary small">Log out</button></form>
      </div>

      <h2>Worker health</h2>
      <div className="grid">
        <div className="card stat"><div className="k">Status</div><div className="v">
          <span className={`badge ${health.status === "ok" ? "ok" : health.status === "starting" ? "warn" : "bad"}`}>{health.status}</span>
        </div></div>
        <div className="card stat"><div className="k">Last successful poll</div><div className="v">{ago(health.lastSuccessfulPoll)}</div></div>
        <div className="card stat"><div className="k">Polls (24 h)</div><div className="v">{pollStats.ok ?? 0} ok / {pollStats.n}</div></div>
        <div className="card stat"><div className="k">Consecutive failures</div><div className="v">{health.consecutiveFailures}</div></div>
        <div className="card stat"><div className="k">Open right now</div><div className="v">{currentOpen.length ? currentOpen.map((o) => formatSlot(o.slot)).join(", ") : "none"}</div></div>
        <div className="card stat"><div className="k">Providers</div><div className="v" style={{ fontSize: 14 }}>
          SMS: {twilioConfigured() ? "Twilio" : "dry-run"} · Email: {resendConfigured() ? "Resend" : "dry-run"}
        </div></div>
      </div>
      {health.lastError && <p className="muted">Last error: {health.lastError}</p>}

      <h2>Queue ({counts.active} waiting · {counts.paused} booked · {counts.unsubscribed} unsubscribed)</h2>
      <p className="muted">
        Everyone who matches a slot is texted at the same moment, so order only decides who goes first in the send loop.
        Listed by sign-up time.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Preferences</th><th>Status</th><th>Alerts today / total / clicks</th><th>Signed up</th><th></th></tr></thead>
          <tbody>
            {signups.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td>{s.phone}<br /><span className="muted">{s.email}</span></td>
                <td>{describePrefs(parseList(s.days), parseList(s.windows))}</td>
                <td><Status s={s} /></td>
                <td>{s.today}/{config.maxAlertsPerPersonPerDay} · {s.total} · {s.clicks}</td>
                <td>{fmt(s.created_at)}</td>
                <td>
                  <div className="row">
                    {s.status === "active" && <form action={pauseSignup.bind(null, s.id)}><button className="secondary small">Mark booked</button></form>}
                    {s.status === "paused" && <form action={resumeSignup.bind(null, s.id)}><button className="secondary small">Resume</button></form>}
                    <form action={removeSignup.bind(null, s.id)}><button className="danger small">Remove</button></form>
                  </div>
                </td>
              </tr>
            ))}
            {signups.length === 0 && <tr><td colSpan={8} className="muted">No sign-ups yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Recent openings</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Slot</th><th>Spots</th><th>Seen</th><th>Gone</th><th>Alerted</th></tr></thead>
          <tbody>
            {openings.map((o) => (
              <tr key={o.id}>
                <td>{formatSlot(o.slot)}</td><td>{o.spots}</td><td>{fmt(o.seen_at)}</td>
                <td>{o.gone_at ? `${fmt(o.gone_at)} (${Math.round((Date.parse(o.gone_at) - Date.parse(o.seen_at)) / 1000)}s open)` : "still open"}</td>
                <td>{o.alerted ? "yes" : "no match"}</td>
              </tr>
            ))}
            {openings.length === 0 && <tr><td colSpan={5} className="muted">No openings seen yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Recent alerts</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Sent</th><th>To</th><th>Slots</th><th>SMS</th><th>Email</th><th>Clicked</th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td>{fmt(a.created_at)}</td><td>{a.name}</td>
                <td>{parseList<string>(a.slots).map(formatSlot).join(", ")}</td>
                <td><span className={`badge ${a.sms_status?.startsWith("sent") ? "ok" : "bad"}`}>{a.sms_status ?? "pending"}</span></td>
                <td><span className={`badge ${a.email_status?.startsWith("sent") ? "ok" : a.email_status ? "bad" : ""}`}>{a.email_status ?? "—"}</span></td>
                <td>{fmt(a.clicked_at)}</td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan={6} className="muted">No alerts sent yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Recent polls</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Result</th><th>Open</th><th>New</th><th>ms</th><th>Error</th></tr></thead>
          <tbody>
            {polls.map((p) => (
              <tr key={p.id}>
                <td>{fmt(p.at)}</td>
                <td><span className={`badge ${p.ok ? "ok" : "bad"}`}>{p.ok ? "ok" : p.http_status ?? "error"}</span></td>
                <td>{p.open_count ?? "—"}</td><td>{p.new_count ?? "—"}</td><td>{p.duration_ms}</td><td>{p.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
