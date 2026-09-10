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
| Phone OTP by SMS | Test numbers are free; real SMS in India costs a few paise to about ₹1 each and needs the pay-as-you-go plan with a card on file. **Check the current price in the console before enabling for the public.** WhatsApp OTP is not available through Firebase (see below). |
| Database (Firestore) | 1 GiB storage, 50k reads / 20k writes per day. A clinic doing 200 bookings a day stays well inside this. |
| Hosting | Not needed; GitHub Pages continues to serve the site |

If you would rather avoid SMS cost entirely, keep only "Continue with Google"
(delete the phone section of `member-login.html`). Members still enter their
WhatsApp number in the profile step, so the care team can reach them.

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
   → enable **Google** (choose a support email) and **Phone**. Under Phone →
   *Phone numbers for testing*, add your own number with a fixed code
   (e.g. `+91 98765 43210 → 123456`) so you can test without SMS charges.
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
   `role` = `admin` (string), `name` = `Istuti` (string) → Save.
7. **Deploy.** Commit and push. GitHub Pages redeploys in about a minute.
8. **Sign in** at `admin-login.html` with that Google account →
   Settings → "Add website experts to panel" → this writes the four doctors
   from `portal-config.js`. Edit their emails first if they will sign in.
9. **Invite doctors.** Admin → Doctors → Add a doctor with their Gmail. They
   open `doctor-login.html` and press "Sign in with Google". Nothing to reset.
10. **Test as a member** from your phone: `member-login.html` → Google or your
    test number → book → confirm it appears in the team console within seconds.

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

What is free today: **Google sign-in**, unlimited. Most Indian smartphone
users have a Google account, so it is a sensible default. SMS OTP costs a few
paise to about a rupee per code on the pay-as-you-go plan; test numbers are
free. If you later pass a few hundred sign-ups a day and want WhatsApp OTP,
budget a day of setup and the per-message fee; the data layer already has
`sendOtp` / `verifyOtp` as the only two functions that would change.

### Costs to watch

- Set a **budget alert** (Google Cloud → Billing → Budgets, ₹500/month) the day
  you switch Phone auth to the pay-as-you-go plan.
- Firestore reads are the only other meter. The console loads everything once
  and then listens for changes, which is cheap; avoid leaving twenty admin tabs
  open all day.

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
