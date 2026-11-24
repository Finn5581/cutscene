# Step 1 recon: Waitwhile, Chrome Hearts Miami

Captured 2026-11-24 with headless Playwright (`capture.js`) and by reading the page's JS bundle.
No booking was attempted. Every slot was full at capture time, so the booking POST was never
sent. Its shape below comes from the client code, not from captured traffic.

## Read endpoints (public, no auth, no captcha)

Base URL: `https://api.waitwhile.com`. The location id is the short name, `chromeheartsmiami`.

| Purpose | Method + path | Notes |
|---|---|---|
| Days with bookable hours | `GET /v2/public/visits/chromeheartsmiami/first-available-dates?fromDate=YYYY-MM-DDTHH:mm&toDate=...` | Returns `["2026-11-24", ...]`. Lists open days even when every slot on them is full. |
| Slots for a range | `GET /v2/public/visits/chromeheartsmiami/availability?fromDate=...&toDate=...` | One object per 30-minute slot (see below) |
| Next free slot(s) | `GET /v2/public/visits/chromeheartsmiami/first-available-slots?fromDate=...&toDate=...&maxNumSlots=1` | Returns `[]` when sold out. This is the cheapest "anything open?" check. |

Request headers: `content-type: application/json` and `waitwhile-client: web-pp-<build>`, plus the
normal browser headers. No cookies or tokens are sent.
Response headers: `cache-control: s-maxage=10, public`, served by Google Frontend. Results are
cached for 10 seconds, so polling faster than that gains nothing.
No rate-limit headers were seen.

Example slot from `/availability`:
```json
{"date":"2026-11-24T11:00","duration":1800,"numSpots":2,"numBookedSpots":3,"numAvailableSpots":0,
 "numSpotsByServiceId":{"WHmjBONC1Mcf8VSqjWar":2, "...":2},
 "numBookedSpotsByServiceId":{"WHmjBONC1Mcf8VSqjWar":3},"numAvailableSpotsByServiceId":{}}
```
A slot is open when `numAvailableSpots > 0` or when the chosen service has a count in
`numAvailableSpotsByServiceId`.

The page also opens a Firestore listen channel on `firestore.googleapis.com` (project `waitwhile-app`,
document `location-status/<id>`). That is a live push of the location's counters. It is not used for slots.

## Location settings (embedded in the page HTML)

- Booking window: `bookingMinNotice` is 900 s (15 min) and `bookingMaxNotice` is 432000 s (5 days). Calendar hours are 11:00 to 19:00, America/New_York.
- Required public fields: name, email, phone, and a service. Party size is optional (max 4).
- Services: In-store shopping `WHmjBONC1Mcf8VSqjWar`, Returning a purchase `wmAh953LCt9dHSUtheks`,
  Product pickup `LesPmsxFCLWoRGp6xzIK`, Repair pickup/drop-off `5to6jKPG9q2dujp6tnmY`,
  Services `QXaVQgigO9XBdcwehngO` / `6aYRwigO1LtehY6R3gPU`.
- Acknowledgement checkboxes (data fields). The page marks them `isRequired:false`, but they are shown:
  - The appointment is **non-transferable and only for the person who booked it**, and photo ID must match the full name.
  - The customer confirms they have **not booked more than 1 appointment in 2 weeks / 5 days**. Duplicates may be cancelled.
- `recaptchaMinScore: 0.7`.
- No SMS or email verification code was found in the booking flow (`allowSMSSignup:false`).

## Write endpoints (from the JS bundle; not exercised)

| Purpose | Method + path | reCAPTCHA action |
|---|---|---|
| Create visit (makes a **pending hold** first) | `POST /v2/public/visits/{locationId}` | `PUB_CREATE_VISIT` |
| Update/confirm visit | `POST /v2/public/visits/{shortName}/{publicVisitId}` | `PUB_UPDATE_VISIT` |
| Release pending holds | `POST /v2/public/visits/{shortName}/expire-pending` body `{visitIds:[...]}` | `PUB_UPDATE_VISIT` |

The payload includes `name`, `firstName`, `lastName`, `phone`, `email`, `date`, the service ids,
`partySize`, data-field answers, and `recaptcha: <token>`. On a 409 (slot contention) the client
retries up to 5 times.

Flow: picking a time creates a **pending visit**, which holds the slot behind a countdown
("your registration will automatically expire in N seconds"). Submitting the form then confirms that visit.

## Protection

- **Every write needs a reCAPTCHA v3 token** (site key `6LfGdiEaAAAAAG5g6cu2j-r4SlU_dYRXQix2-jio`)
  that scores at least 0.7. On a low score the client retries with a **visible reCAPTCHA v2 challenge**
  ("Please verify you're not a robot").
- reCAPTCHA is skipped only when the location sets `recaptchaMinScore === -1` or the caller is on an
  IP allowlist (`recaptchaIpAllowlist`, which is null here).

## Verdict

- **Monitoring with direct HTTP: yes.** The three GET endpoints are public, light and cached. Polling every 20 to 30 s with jitter is well within reason.
- **Booking with direct HTTP: no.** It needs a reCAPTCHA token, and getting one outside a real user's browser is a captcha bypass.
- **Booking with Playwright: also no, under your constraints.** reCAPTCHA v3 is a bot score. A headless browser on a cloud IP will score below 0.7 and get the v2 challenge. Any effort to get past that (stealth plugins, residential proxies, solver services) is captcha evasion. Each attempt would also create a pending hold on the slot.
- **Store policy conflict:** the shop requires the appointment to be booked by and for the attendee, with matching ID, and limits it to one booking per 2 weeks.

**Recommendation:** build steps 2, 3 and 5 as specified, and replace step 4 with the "captcha fallback" you
already defined: when a matching slot appears, text and email the person within seconds with the
deep link to that date, so they complete the booking (and the captcha) themselves.

## Addendum: deep link (verified)

The booking page reads these query parameters:
- `date=YYYY-MM-DDTHH:mm` preselects that day. A plain `YYYY-MM-DD` is ignored.
- `name`, `firstname`, `lastname`, `email`, `phone` prefill the form.

Example: `https://waitwhile.com/locations/chromeheartsmiami/time?registration=booking&date=2026-11-27T14:00&firstname=Ana&lastname=Rivera`.
The `slot-alerts` app uses this for the links in its alerts.
