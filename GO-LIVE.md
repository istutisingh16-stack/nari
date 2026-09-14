# NARI Health — Going live and building the business

Two parts. **Part A** takes the portal live for ₹0/month in about an hour.
**Part B** is what we recommend doing next to turn it into revenue.

---

## Part A — Take the portal live (free tier, no servers)

The whole site stays on GitHub Pages. Sign-in and the database run on
Firebase's free **Spark** plan. The only file you edit is `portal-config.js`.

### Why Firebase and not "just the browser"

The demo stores everything in `localStorage`, which lives in one browser on one
device. The moment a real member books from her phone, the team cannot see it
on their laptop. A shared database is unavoidable to go live. Firebase is the
cheapest way to get one plus Google and phone sign-in without running a server:

| Need | Firebase free tier |
|---|---|
| Google sign-in | Free, unlimited |
| Phone OTP by SMS | Test numbers are free. Real SMS needs the **Blaze (pay-as-you-go)** plan with a card on file; in India each code costs a few paise to about ₹1. **Check the current price in the console before enabling for the public.** WhatsApp OTP is not available through Firebase (see below). |
| Database (Firestore) | 1 GiB storage, 50k reads / 20k writes per day. A clinic doing 200 bookings a day stays well inside this. |
| Hosting | Not needed; GitHub Pages continues to serve the site |

Member sign-in is **mobile number + one SMS code**, nothing else. Firebase
remembers the device, so the SMS is usually sent once per device, not on every
visit. That
verified number is what links her to the doctor who added her. Until Phone
sign-in billing is enabled, real numbers see "SMS codes are not switched on
for this project yet"; test numbers (step 2) work regardless.

### Steps

Your project already exists: **NARI-health** (`nari-health-33e31`) and its full
web config is already in `portal-config.js`, so the portal is in **live mode**
as soon as it is deployed. Step 1 is done; start at step 2.

1. ~~Copy `apiKey` and `appId`~~ — done. For reference: open
   https://console.firebase.google.com/project/nari-health-33e31/settings/general
   → scroll to **Your apps**. If no web app is listed, click **Add app → Web (</>)**,
   nickname "NARI portal", leave Hosting unticked, Register. Under
   *SDK setup and configuration* pick **Config** and copy the `apiKey`
   (starts with `AIza`) and `appId` (starts with `1:312059255860:web:`) into
   the two empty strings in `portal-config.js`. The portal switches from demo
   to live the moment both are present.
2. **Enable sign-in methods.**
   https://console.firebase.google.com/project/nari-health-33e31/authentication/providers
   → enable **Phone** (members), **Google** (staff; choose a support email), and
   **Email/Password** (needed for doctor and team credentials). Under Phone →
   *Phone numbers for testing*, add your own number with a fixed code
   (e.g. `+91 98765 43210 → 123456`) so you can test without SMS charges.
   For real members' numbers, upgrade the project to **Blaze** (Project
   settings → Usage and billing) and set a budget alert; Firebase refuses to
   send SMS on the free plan.
3. **Authorise your domains.** Authentication → Settings → Authorized domains →
   add `narihealth.in`, `www.narihealth.in`, your `*.github.io` host, and
   `localhost`.
4. **Create the database.** (Until this is done, the portal shows a red
   "Could not reach the database" message after a few seconds. That is the
   only thing standing between you and live.)
   https://console.firebase.google.com/project/nari-health-33e31/firestore →
   Create database → production mode → region `asia-south1` (Mumbai).
5. **Paste the rules.** Firestore → Rules → replace everything with the
   contents of `firestore.rules` → Publish.
6. **Add the first admin.** Firestore → Data → Start collection `staff` →
   Document ID = your Google email (e.g. `istuti@gmail.com`) → fields
   `role` = `admin` (string), `name` = `Istuti` (string) → Save. Sign in at
   `/admin/` with Google. Every further doctor or admin is created from the
   console with an email and temporary password; nobody else needs the Firebase
   console again.
7. **Deploy.** Commit and push. GitHub Pages redeploys in about a minute.
8. **Sign in** at `/admin/` with that Google account → Team & settings →
   "Add website experts to panel" → this writes the four doctors from
   `portal-config.js` without passwords. Press **Reset password** next to each
   to email them a set-password link, or add doctors one by one instead.
9. **Add doctors.** Admin → Doctors → Add a doctor: name, speciality, sign-in
   email and a temporary password (the console generates one). Share both with
   the doctor privately. They open `/doctor/`, sign in, and can change the
   password with "Forgot password". Doctors can then add their own members
   from the panel.
10. **Test as a member** from your phone: `member-login.html` → your
    test number → the fixed code → book → confirm it appears in the team
    console within seconds. To test the doctor link, first add that same test
    number from `/doctor/` → Add a member, then sign in as the member; the
    doctor's name should appear under "Your referring doctor".

### Can the OTP come on WhatsApp instead of SMS, for free?

Short answer: **no, not for free, and not through Firebase.**

- Firebase Authentication only delivers phone codes by SMS. There is no
  WhatsApp option to switch on.
- Sending an OTP on WhatsApp means using Meta's WhatsApp Business Platform
  (Cloud API) with an *authentication template*. Meta charges per
  authentication message (in India roughly ₹0.11–0.15 each, cheaper than SMS
  but not zero). The free monthly allowance covers only conversations the
  member starts, not codes you send.
- It also needs a server that holds your Meta access token and then mints a
  Firebase custom token so Firestore rules recognise the member. That cannot
  run on GitHub Pages. Cheapest hosts are Cloudflare Workers (free tier) or
  Firebase Cloud Functions (pay-as-you-go plan).
- It needs a Meta Business account, business verification, and a phone number
  registered to the API. A number registered to the API can no longer be used
  in the normal WhatsApp app, so it would be a second number, not
  `+91 63995 07521`.

What is free today: **Google sign-in for staff**, unlimited. SMS OTP costs a few paise
to about a rupee per code on the pay-as-you-go plan, and is sent once per
member (the number stays linked to her account); test numbers are free. If
you later pass a few hundred sign-ups a day and want WhatsApp OTP, budget a
day of setup and the per-message fee; the data layer already has `sendOtp` /
`verifyOtp` as the only two functions that would change.

### Costs to watch

- Set a **budget alert** (Google Cloud → Billing → Budgets, ₹500/month) the day
  you switch Phone auth to the pay-as-you-go plan.
- Firestore reads are the only other meter. The console loads everything once
  and then listens for changes, which is cheap; avoid leaving twenty admin tabs
  open all day.

### The three entrances

| Who | URL | Listed on the website? |
|---|---|---|
| Members | `/member-login.html` | Yes ("Sign in" and "Book a consultation") |
| Doctors | `/doctor/` | No. Share it with doctors directly. |
| Team | `/admin/` | No. |

Hiding the URLs is convenience, not the security. The security is that the
`staff` list is writable only by admins, and anyone not on it is refused at
sign-in even with a valid Google account or password.

### Security notes

- `firestore.rules` is what protects member data. The browser code is not
  trusted. Any new field or collection needs a rule.
- The Firebase `apiKey` in `portal-config.js` is **not a secret**; it
  identifies the project. Access is controlled by rules and authorised domains.
- Doctor emails live only in `staff`, which members cannot read.
- Keep the "Demo" banners: they disappear automatically in live mode.

---

## Part B — What needs to be done to make a business from it

Ordered by impact for a women's health and lifestyle brand in India. Items in
the first block can ship in the next two to four weeks on the same free stack.

### 1. Take money (weeks 1–2)

- **Razorpay Payment Links or Payment Pages.** No backend needed. When the care
  coordinator confirms a booking, the console sends a Razorpay link on WhatsApp;
  Razorpay's webhook is optional at this stage. Fee is about 2% per transaction,
  no monthly cost. Move to Razorpay Checkout inside `member.html` once volume
  justifies a small Cloud Function to verify signatures.
- **Pricing that fits a lifestyle brand.** Keep pay-per-visit, and add
  outcome-shaped programmes rather than subscriptions: "PCOS reset — 3 sessions
  with a gynaecologist and a nutritionist, ₹1,999", "Prenatal companion — one
  call a month for 9 months", "Menopause plan". Programmes have higher order
  value and a natural reason to book again. They are not subscriptions; they
  are packages with an end.
- **Cancellation and refund policy** in `terms.html` matching what the console
  actually does (24-hour notice, refund path). Already partly updated.

### 2. Make WhatsApp do the operational work (weeks 2–4)

WhatsApp is the channel members already trust, so use it for logistics, not as
the product:

- **WhatsApp Business App** (free) today: quick replies for "confirmed",
  "payment link", "reminder", labels per status.
- **WhatsApp Business API** via a provider (Interakt, AiSensy, Gupshup; roughly
  ₹0.10–0.80 per template message) once you pass ~30 bookings a day:
  automatic "booking received", "confirmed with Dr. X at 10 AM", "reminder 1
  hour before", "how was it? leave a rating". Trigger these from a tiny Cloud
  Function on Firestore writes (free tier covers 2M invocations/month).
- Put the **WhatsApp number in the profile step** to work: it already collects
  it; this is your reachability guarantee.

### 3. Supply side: doctors (ongoing)

- **Referral incentive.** The doctor panel already tracks referred members.
  Attach a small revenue share (10–15% of the first consultation) or a flat
  ₹100 per completed referral, paid monthly, visible on the doctor dashboard.
- **Availability.** Add `slots` per doctor (days of week + times) so members
  book real openings instead of "preferred time". Small change in
  `portal-config.js` → `doctors[].availability` and the booking form.
- **Credential verification page** per doctor (registration number, council)
  linked from the expert card. Trust is the product.
- **Google Meet links** for video consultations: paste one per doctor into
  their profile; the confirmed booking shows it to the member.

### 4. Compliance you cannot skip (before scale)

- **Telemedicine Practice Guidelines 2020 (India)**: only registered medical
  practitioners consult; identity of patient and RMP confirmed; consent
  recorded (the Terms checkbox is a start, add a one-line consent on the
  booking form); prescriptions only after a video or audio consult, never
  chat-only for first consults.
- **DPDP Act 2023**: health data is personal data. You need a privacy notice
  (exists), a way to delete a member on request (admin → members → delete;
  add it), and a data-processing note for Firebase (Google Cloud, Mumbai
  region).
- **Not-for-emergency disclaimer** on every dashboard footer (present).
- Register the entity, get a GST number before Razorpay live mode.

### 5. Growth loops (weeks 4–12)

- **Landing page → booking funnel.** The site now sends visitors to
  `member-login.html`. Add Google Analytics 4 or Plausible and track: sign-in
  started, sign-in completed, booking requested, booking confirmed, paid.
- **Referral for members.** Give every member her own code (same mechanism as
  doctors). "Refer a friend, both get ₹100 off."
- **Content that ranks.** One article a week on the concerns you already list
  (PCOS, periods, menopause, pelvic health) with a "Book a consultation" CTA.
  Women's health queries in India are high volume and under-served in plain
  English and Hindi.
- **Instagram and WhatsApp forwards** are already your top referral sources in
  the demo data; the admin overview measures them. Keep the "How did you hear
  about us?" field mandatory-ish.
- **Corporate wellness (B2B).** A "NARI for teams" page: company pays for a
  block of consultations for employees. One deal covers months of B2C growth.
- **Ratings after each consultation** (member gets a WhatsApp link → 1–5 stars
  and a line). Display on expert cards. This is the strongest conversion lever
  for a new brand.

### 6. Product hygiene

- Custom domain for the portal (`app.narihealth.in` via GitHub Pages CNAME).
- Email fallback for OTP failures (Firebase email link sign-in is free).
- Export bookings to Google Sheets weekly for accounting (Firestore → Sheets
  via Apps Script, free).
- Add a **status page for members**: "your request → confirmed → paid → done".
- Move the four hard-coded experts from `script.js` to the live `doctors`
  collection so the website and the panel never disagree.

### Suggested order

1. Firebase live (Part A) → 2. Razorpay links + programmes → 3. WhatsApp
Business App templates → 4. Ratings + doctor availability → 5. Analytics and
member referral → 6. WhatsApp API automation → 7. B2B page.

## Payments (Paytm)

1. Open the Paytm for Business app → Profile → copy your **UPI ID**
   (looks like `1234567890@paytm`). Paste it into `portal-config.js` →
   `payments.upiId`. From then on **Pay with Paytm** on the member page opens
   Paytm with the amount filled in (₹799 by default).
2. Optional but recommended: Paytm Business → **Payment Links** → create one
   link per plan (₹999 pass, ₹199 single) and a **Subscription** link for the
   ₹799/month plan. Paste each URL into `payments.plans[].link`. The
   subscription link is what makes the ₹799 renew automatically; without it the
   first month is a one-time payment and you remind the member each month.
3. Publish the updated `firestore.rules` (it adds the `payments` collection).
4. Verify payments in the console → **Payments**: compare the member's UPI
   reference with your Paytm statement and press **Mark paid**. Her plan goes
   live immediately.

## If the SMS code does not arrive ("Verification failed" / security check)

Phone sign-in needs a reCAPTCHA token from Google before Firebase sends the SMS.
Check these in order; the page now shows the exact Firebase error code when it
is not one it recognises.

1. **Authorized domains.** Firebase console → Authentication → Settings →
   Authorized domains must contain `narihealth.in`, `www.narihealth.in` and
   any GitHub Pages address you test from. Missing domain = "SMS sign-in is not
   enabled for <host> yet" (Firebase code `auth/captcha-check-failed`).
2. **Phone provider on.** Authentication → Sign-in method → Phone → Enabled.
3. **Billing.** New Firebase projects need the Blaze (pay-as-you-go) plan for
   real SMS (`auth/billing-not-enabled`). A few paise per code.
4. **API key restrictions.** Google Cloud → APIs & Services → Credentials → the
   browser key: either no restrictions, or HTTP referrers that include
   `narihealth.in/*`, and the Identity Toolkit API allowed.
5. **Test without SMS.** Authentication → Sign-in method → Phone → *Phone
   numbers for testing*: add your own number with a fixed code (e.g. 123456).
   Sign-in then works instantly and costs nothing.
6. If the invisible check keeps failing on a device, the page automatically
   switches to the visible "I'm not a robot" box on the second attempt.

"Missing or insufficient permissions" after sign-in means the published
Firestore rules are older than the code. Paste `firestore.rules` into
Firestore → Rules → Publish (step 5) and reload.
