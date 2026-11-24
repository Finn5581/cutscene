/**
 * All configuration comes from environment variables (see .env.example / README).
 * Nothing secret is hard-coded here.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be a number, got "${raw}"`);
  return n;
}

function str(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // --- Target location -------------------------------------------------------
  /** Waitwhile location short name (from the booking URL). */
  locationShortName: str("WAITWHILE_LOCATION", "chromeheartsmiami"),
  /** Human-friendly name used in messages. */
  locationLabel: str("LOCATION_LABEL", "Chrome Hearts Miami"),
  timezone: str("LOCATION_TIMEZONE", "America/New_York"),
  /**
   * Optional comma-separated Waitwhile service ids. When set, a slot only counts
   * as open if one of these services has a free spot. Empty = any service.
   */
  targetServiceIds: str("TARGET_SERVICE_IDS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // --- Booking window (matches the location's own settings) ------------------
  minNoticeMinutes: num("MIN_NOTICE_MINUTES", 15),
  maxNoticeDays: num("MAX_NOTICE_DAYS", 5),
  /** Slot start hours, local time: start >= openHour and start < closeHour. */
  openHour: num("OPEN_HOUR", 11),
  closeHour: num("CLOSE_HOUR", 19),

  // --- Polling ----------------------------------------------------------------
  pollMinSeconds: num("POLL_MIN_SECONDS", 20),
  pollMaxSeconds: num("POLL_MAX_SECONDS", 30),
  /** Longest back-off after repeated errors. */
  maxBackoffSeconds: num("MAX_BACKOFF_SECONDS", 900),
  requestTimeoutMs: num("REQUEST_TIMEOUT_MS", 10_000),

  // --- Alert limits -----------------------------------------------------------
  maxAlertsPerPersonPerDay: num("MAX_ALERTS_PER_PERSON_PER_DAY", 5),
  bookedPauseDays: num("BOOKED_PAUSE_DAYS", 14),

  // --- Reliability ------------------------------------------------------------
  staleAfterSeconds: num("STALE_AFTER_SECONDS", 300),
  /** Minimum gap between two admin alerts of the same kind. */
  adminAlertCooldownMinutes: num("ADMIN_ALERT_COOLDOWN_MINUTES", 30),

  // --- Infrastructure -----------------------------------------------------------
  dbPath: str("DB_PATH", "./data/app.db"),
  /** Public URL of this site, used for links in SMS/email, e.g. https://alerts.example.com */
  publicBaseUrl: str("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, ""),

  // --- Providers (all optional: missing keys = log instead of send) -------------
  twilioAccountSid: str("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: str("TWILIO_AUTH_TOKEN"),
  twilioFromNumber: str("TWILIO_FROM_NUMBER"),
  twilioMessagingServiceSid: str("TWILIO_MESSAGING_SERVICE_SID"),
  resendApiKey: str("RESEND_API_KEY"),
  resendFrom: str("RESEND_FROM"),

  // --- Admin --------------------------------------------------------------------
  adminPassword: str("ADMIN_PASSWORD"),
  sessionSecret: str("SESSION_SECRET"),
  adminPhone: str("ADMIN_PHONE"),
  telegramBotToken: str("TELEGRAM_BOT_TOKEN"),
  telegramChatId: str("TELEGRAM_CHAT_ID"),
};

export const twilioConfigured = () =>
  Boolean(
    config.twilioAccountSid &&
      config.twilioAuthToken &&
      (config.twilioFromNumber || config.twilioMessagingServiceSid),
  );

export const resendConfigured = () => Boolean(config.resendApiKey && config.resendFrom);

/** Public booking page (no deep link). */
export const bookingPageUrl = () =>
  `https://waitwhile.com/locations/${config.locationShortName}/time?registration=booking`;
