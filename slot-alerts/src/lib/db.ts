/**
 * SQLite storage using Node's built-in `node:sqlite` (no native build step).
 * The web app and the worker are separate processes that open the same file;
 * WAL mode plus a busy timeout keeps that safe.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config";

export type SignupStatus = "active" | "paused" | "unsubscribed";

export interface Signup {
  id: number;
  name: string;
  email: string;
  phone: string; // E.164
  days: string; // JSON array of weekday numbers (0=Sun)
  windows: string; // JSON array of window ids, see prefs.ts
  sms_consent: number;
  email_alerts: number;
  status: SignupStatus;
  paused_until: string | null; // ISO timestamp
  token: string; // secret used in personal links
  created_at: string;
}

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS signups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL,
      phone         TEXT NOT NULL UNIQUE,
      days          TEXT NOT NULL,
      windows       TEXT NOT NULL,
      sms_consent   INTEGER NOT NULL DEFAULT 0,
      email_alerts  INTEGER NOT NULL DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'active',
      paused_until  TEXT,
      token         TEXT NOT NULL UNIQUE,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- One row per message sent to a person (one SMS + one email, possibly listing several slots).
    CREATE TABLE IF NOT EXISTS alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      signup_id     INTEGER NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
      code          TEXT NOT NULL UNIQUE,   -- short code for the /go/<code> booking link
      slots         TEXT NOT NULL,          -- JSON array of slot strings, first = headline
      local_day     TEXT NOT NULL,          -- for the per-day cap
      sms_status    TEXT,
      email_status  TEXT,
      clicked_at    TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS alerts_signup_day ON alerts(signup_id, local_day);

    -- Dedupe: a person is told about a given slot at most once, ever.
    CREATE TABLE IF NOT EXISTS alerted_slots (
      signup_id     INTEGER NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
      slot          TEXT NOT NULL,
      PRIMARY KEY (signup_id, slot)
    );

    -- Every poll, for the admin page and debugging.
    CREATE TABLE IF NOT EXISTS polls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      ok            INTEGER NOT NULL,
      http_status   INTEGER,
      open_count    INTEGER,
      new_count     INTEGER,
      duration_ms   INTEGER,
      error         TEXT
    );

    -- History of slots that opened (first time seen open in a run of polls).
    CREATE TABLE IF NOT EXISTS openings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slot          TEXT NOT NULL,
      spots         INTEGER,
      seen_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      gone_at       TEXT,
      alerted       INTEGER NOT NULL DEFAULT 0
    );

    -- Small key/value store: heartbeats, last open set, admin-alert throttling.
    CREATE TABLE IF NOT EXISTS kv (
      key           TEXT PRIMARY KEY,
      value         TEXT NOT NULL
    );
  `);
  return db;
}

// --- kv helpers ---------------------------------------------------------------

export function kvGet(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

/** Random URL-safe token. */
export function randomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Reactivate people whose 14-day "I booked it" pause has ended. */
export function expirePauses(): void {
  getDb()
    .prepare("UPDATE signups SET status = 'active', paused_until = NULL WHERE status = 'paused' AND paused_until IS NOT NULL AND paused_until <= ?")
    .run(new Date().toISOString());
}

/** Keep the polls table from growing forever. */
export function prunePolls(days = 7): void {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  getDb().prepare("DELETE FROM polls WHERE at < ?").run(cutoff);
}
