# NARI Health — Portal (members / doctors / team)

A front-end portal that sits next to the landing page. No build step, so it
deploys on GitHub Pages exactly like the rest of the site. It runs in one of
two modes, chosen by `portal-config.js`:

| Mode | When | Sign-in | Data |
|---|---|---|---|
| **Demo** | `firebase: null` (default) | Simulated Google, on-screen OTP, demo staff passwords | `localStorage` in this browser only |
| **Live** | Firebase config pasted in | Google, phone OTP via SMS (Firebase Authentication) | Cloud Firestore, shared, protected by `firestore.rules` |

Going live is described step by step in [GO-LIVE.md](GO-LIVE.md).

## Vocabulary

The women who use NARI are **members**, not patients. NARI is a lifestyle and
wellness brand, so the word appears everywhere in the portal copy and in the
data model (`members`, `memberId`). Change `memberWord` in `portal-config.js`
if you ever prefer another word; the UI reads it from there.

WhatsApp is a **support channel**, not a product. There is no paid or
subscription WhatsApp consult anywhere in the portal or the landing page.
Consultation modes and prices live in `portal-config.js → modes`.

## Pages

| URL | Who | What |
|---|---|---|
| `login.html` | everyone | Role chooser. Linked from the navbar "Sign in". |
| `member-login.html` | members | Continue with Google **or** mobile number + 6-digit OTP. New members finish a short profile (name, city, WhatsApp number). Accepts `?ref=NH-CODE` referral links. |
| `doctor-login.html` | panel doctors | Live: Google sign-in with the email the team registered. Demo: email + password. |
| `admin-login.html` | NARI team | Live: Google sign-in for emails in the `staff` collection with `role: admin`. Demo: email + password. |
| `member.html` | members | Book a consultation (concern, expert, mode, date/time, notes, how they heard about NARI + referral code). Upcoming and past consultations, cancel, WhatsApp the care team. |
| `doctor.html` | doctors | Stats, **referred members**, own consultations with confirm / complete / cancel, referral code + shareable link + WhatsApp share. |
| `admin.html` | team | Overview (stat tiles, needs-attention queue, referral source breakdown, per-doctor referral counts), all consultations (search, filter, assign expert, change status), members, doctors (add, pause, copy referral link), settings (team access, export JSON, import website experts, status). |

## Demo accounts (demo mode only)

| Role | Sign in with |
|---|---|
| Member | any 10-digit number; the code is shown on screen. `98765 01001` is a returning demo member. "Continue with Google" signs in as a sample Google account. |
| Doctor | `sudha@` / `hanifa@` / `nisha@` / `sneha@narihealth.in`, password `doctor123` |
| Team | `admin@narihealth.in`, password `admin123` |

Referral codes: `NH-SUDHA`, `NH-HANIFA`, `NH-NISHA`, `NH-SNEHA`.
A referral link looks like `member-login.html?ref=NH-SUDHA`.

## How it is built

- `portal-config.js` — the only file to edit to go live. Firebase config, brand
  words, WhatsApp number, consultation modes, categories, seed doctors.
- `portal-data.js` — the **only** file that reads or writes data. Exposes
  `NariPortal`. Pages call `NariPortal.ready(role)` and get a Promise for the
  signed-in user; after that every read is synchronous from an in-memory cache
  and writes update the cache first, then persist (localStorage or Firestore).
  In live mode Firestore listeners keep the cache fresh and pages re-render via
  `NariPortal.subscribe(fn)`.
- `portal.js` — shared UI: icons, toasts, badges, consultation cards, navbar,
  tabs, confirm dialog, Google button, busy states, demo/live toggles
  (`data-demo-only`, `data-live-only`).
- `portal.css` — portal components on top of the core theme in `styles.css`.
- `firestore.rules` — the access rules that actually protect member data.

### Data model

| Collection | Key | Fields |
|---|---|---|
| `doctors` | `doctorId` | `name, role, exp, refCode, active, img, categories[]` — public, no email |
| `staff` | email | `role: 'admin' \| 'doctor', doctorId?, name` (+ `password` in demo only) |
| `members` | Firebase uid (demo: generated id) | `name, phone, email, city, img, provider, createdAt` |
| `appointments` | generated id | `memberId, memberName, memberPhone, memberCity, doctorId, category, mode, date, time, notes, status, referredBy, referredDoctorId, createdAt` |

Member details are copied onto each appointment so doctors can see who booked
without being able to read the `members` collection. `referredBy` is either
`{type:'doctor', doctorId}` or `{type:'source', label}`; `referredDoctorId`
duplicates the doctor id so Firestore can query it.

### Access (enforced by `firestore.rules`)

- Members read and write their own profile, create their own bookings (always
  `pending`), and may only change a booking's status to `cancelled`.
- Doctors read bookings where they are the expert or the referrer, and may
  change the status of their own consultations.
- Admins read and write everything. Admin is granted by a `staff/{email}`
  document with `role: 'admin'`.
- Doctor profiles are publicly readable so the booking form and referral links
  work before sign-in.

The portal pages are excluded from search engines via `robots.txt` and a
`noindex` meta tag.
