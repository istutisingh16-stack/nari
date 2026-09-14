# NARI Health — Portal (members / doctors / team)

A front-end portal that sits next to the landing page. No build step, so it
deploys on GitHub Pages exactly like the rest of the site. It runs in one of
two modes, chosen by `portal-config.js`:

| Mode | When | Sign-in | Data |
|---|---|---|---|
| **Demo** | `firebase: null` | On-screen OTP for members, demo staff passwords | `localStorage` in this browser only |
| **Live** | Firebase config present (current) | Members: mobile number + one-time SMS code only. Staff: email + password (or Google). All via Firebase Authentication | Cloud Firestore, shared, protected by `firestore.rules` |

Going live is described step by step in [GO-LIVE.md](GO-LIVE.md).

## Three separate entrances

| Who | URL | How they get in |
|---|---|---|
| Members | `/member-login.html` (the only sign-in linked from the website) | Mobile number + 6-digit SMS OTP. No Google, no password. Anyone can join. |
| Doctors | `/doctor/` (unlisted, not linked anywhere public, `noindex`) | Email + password created by an admin, or Google with that same email. |
| Team | `/admin/` (unlisted, `noindex`) | Email + password created by another admin, or Google with a listed email. |

Nobody can become a doctor or admin by signing up: the `staff` collection is
writable only by admins, and a person whose email is not in it is refused at
sign-in even if they hold a valid Google or password account. `/login.html`
simply forwards to the member sign-in.

## Vocabulary

The women who use NARI are **members**, not patients. NARI is a lifestyle and
wellness brand, so the word appears everywhere in the portal copy and in the
data model (`members`, `memberId`). Change `memberWord` in `portal-config.js`
if you ever prefer another word; the UI reads it from there.

WhatsApp is a **support channel**, not a product. There is no paid or
subscription WhatsApp consult anywhere in the portal or the landing page.
Consultation modes and prices live in `portal-config.js → modes`.

## Call-back enquiries (no sign-in)

The home page and the five local landing pages carry a **"Get a free call back"**
form (`lead-form.js`): name, mobile, concern, best time to call. It writes a
`leads/{id}` document straight to Firestore with no account, so a visitor from an
ad is captured in one step. The team console shows them under **Enquiries** with
Call / WhatsApp buttons and a status. If Firestore is unreachable the form opens
WhatsApp with the details pre-filled instead. A hidden honeypot field and strict
rules (`firestore.rules` → `leads`) keep bots out. `?ref=NH-CODE` and `utm_*`
parameters on the URL are saved on the lead so you can see which doctor or
campaign sent her.

## What each portal does

| Page | What |
|---|---|
| `member-login.html` | Three steps: **mobile number** → **6-digit SMS code** → short profile (name, city; new members only). Light, low-pink theme. Firebase signs her in with a phone-only account (`signInWithPhoneNumber`), so the ID token carries `phone_number`. If the invisible reCAPTCHA is rejected, the second attempt shows the visible "I'm not a robot" box. Accepts `?ref=NH-CODE` referral links. If a doctor had added this member with that number, her account is linked to that doctor automatically. |
| `member.html` | Book a consultation (concern, expert, mode, date/time, notes, how they heard about NARI + referral code). Upcoming and past consultations, cancel, WhatsApp the care team. Shows **"Your referring doctor"** when a doctor added or referred her, and pre-fills the referral on every booking. |
| `doctor/panel.html` | Stats; **My members** (women the doctor added, plus anyone who booked with the doctor's code), with "Not signed up yet" status, WhatsApp invite, and consultation history; **Add a member** form (name, phone, city, optional email and note); own consultations with confirm / complete / cancel; referral code + link + WhatsApp share. |
| `admin/console.html` | Overview (stat tiles, needs-attention queue, referral source breakdown, per-doctor member counts); all consultations (search, filter, assign expert, change status); members including those added by doctors but not yet signed up; doctors (add with sign-in credentials, pause, reset password, copy referral link); team access (add admins with credentials, reset password, remove); export JSON; import website experts. |

### Doctor-added members, end to end

1. Doctor fills **Add a member** → an `invites/{phone}` document is written
   with `doctorId`. She appears immediately in the doctor's list as
   "Not signed up yet", and in the admin console.
2. The doctor can press **Invite on WhatsApp** to send her the sign-in link.
3. She signs in at `member-login.html` with **that
   same mobile number** with the SMS code. On her first load the portal finds
   the invite, marks it claimed, and writes `referredByDoctorId` on her profile.
   (If the doctor also recorded her email, the email match works as a fallback.)
4. Her portal now shows the doctor under "Your referring doctor" and every
   booking is pre-filled as referred by that doctor.
5. The doctor's list flips her to signed up and shows her visits as they happen.

Only a verified match claims an invite: the phone number she proved with the
SMS code (`request.auth.token.phone_number`), or the email on the
account she signed in with. Nobody can claim an invite by typing someone
else's number, because the number on a profile must equal the verified one
(`firestore.rules` → `phoneMatchesToken`).

Members who joined earlier with Google and then verified their number land in
that same Firebase account when they now sign in by phone (the number is the
key), so their profile and bookings are unchanged.

## Demo accounts (demo mode only)

| Role | Sign in with |
|---|---|
| Member | Enter any 10-digit number; the code is shown on screen. `98765 01001` (Priya S.) and `98765 01003` (Kavita R.) are returning demo members. |
| Doctor | `sudha@` / `hanifa@` / `nisha@` / `sneha@narihealth.in`, password `doctor123` |
| Team | `admin@narihealth.in`, password `admin123` |

Referral codes: `NH-SUDHA`, `NH-HANIFA`, `NH-NISHA`, `NH-SNEHA`.
A referral link looks like `member-login.html?ref=NH-SUDHA`.

## How it is built

- `portal-config.js` — Firebase config, brand words, WhatsApp number,
  consultation modes, categories, seed doctors.
- `portal-data.js` — the **only** file that reads or writes data. Exposes
  `NariPortal`. Pages call `NariPortal.ready(role)` and get a Promise for the
  signed-in user; after that every read is synchronous from an in-memory cache
  and writes update the cache first, then persist (localStorage or Firestore).
  In live mode Firestore listeners keep the cache fresh and pages re-render via
  `NariPortal.subscribe(fn)`. `NariPortal.ROOT` is the absolute site root, so
  pages under `/doctor/` and `/admin/` redirect correctly on any host.
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
| `members` | Firebase uid (demo: generated id) | `name, phone, email, city, img, provider, createdAt, referredByDoctorId?` |
| `invites` | 10-digit phone | `phone, phoneE164, name, city, email, note, doctorId, createdAt, claimedBy, claimedAt` |
| `appointments` | generated id | `memberId, memberName, memberPhone, memberCity, doctorId, category, mode, date, time, notes, status, referredBy, referredDoctorId, createdAt` |
| `leads` | generated id | `name, phone, concern, time (morning/afternoon/evening), page, ref, utm{source,medium,campaign}, status (new/contacted/booked/closed), createdAt` — written without sign-in by `lead-form.js` |

Member details are copied onto each appointment so doctors can see who booked
without being able to read the `members` collection. `referredBy` is either
`{type:'doctor', doctorId}` or `{type:'source', label}`; `referredDoctorId`
duplicates the doctor id so Firestore can query it.

### Access (enforced by `firestore.rules`)

- Members read their own profile. Writing it, and creating a booking (always
  `pending`), requires the SMS-verified `phone_number` claim, and the `phone`
  saved on the profile must be that number. Members may only change a
  booking's status to `cancelled`.
- Doctors read bookings where they are the expert or the referrer, change the
  status of their own consultations, and create / read / remove their own
  invites.
- A signed-in member can read and claim only the invite that matches her
  verified phone or her account email.
- Admins read and write everything. Admin is granted by a `staff/{email}`
  document with `role: 'admin'`.
- Doctor profiles are publicly readable so the booking form and referral links
  work before sign-in.

### Staff credentials

Admins create doctor and admin sign-ins from the console. The browser uses a
second Firebase app instance to call `createUserWithEmailAndPassword`, so the
admin stays signed in. If the email already has an account the record is still
added and the person uses **Forgot password**. Admins can also send a
password-reset email from the console.

The portal pages are excluded from search engines via `robots.txt` and a
`noindex` meta tag.

## Payments (Paytm)

The site has no server, so there is no hosted checkout. Instead:

1. On `member.html` → **Your plan** the member picks a plan (default: **Monthly
   membership ₹799/month**; also **1-month pass ₹999** and **Single
   consultation ₹199**) and presses **Pay with Paytm**.
2. The browser writes `payments/{id}` (`status: 'initiated'`) and opens Paytm:
   on a phone via the `paytmmp://pay?...&am=799.00` intent (falls back to
   `upi://pay` if Paytm is not installed); elsewhere via the plan's Paytm
   payment link if one is set in `portal-config.js`, or by showing the UPI ID.
   With no UPI ID configured the button opens WhatsApp instead.
3. She enters the UPI reference / UTR from Paytm → `status: 'claimed'`.
4. The team console → **Payments** shows claimed payments; an admin checks the
   Paytm for Business statement and marks **Paid** (or Not received).
5. `NariPortal.payments.entitlement(memberId)` derives what she has: a plan
   valid for `days` from `paidAt`, or unused single consultations. The booking
   summary shows "Covered by your plan" accordingly.

Recurring ₹799 auto-debit needs a Paytm **Subscription** link (Paytm Business →
Subscriptions) pasted into `payments.plans[0].link`; a plain UPI payment cannot
create a mandate, so without it the first month is a one-time ₹799 and the
team reminds the member monthly.

| Collection | Key | Fields |
|---|---|---|
| `payments` | generated id | `memberId, memberName, memberPhone, planId, planLabel, amount, recurring, status (initiated/claimed/paid/failed/refunded), txnRef, createdAt, claimedAt?, paidAt?` |
