/* ===== NARI Health — Portal configuration =====
   This is the ONLY file you need to edit to take the portal live.

   1. Create a free Firebase project (Spark plan) at https://console.firebase.google.com
   2. Enable Authentication → Sign-in method → Phone (members) and Email/Password + Google (staff).
   3. Create a Firestore database (production mode) and paste firestore.rules.
   4. Add your domains (narihealth.in, <user>.github.io, localhost) under
      Authentication → Settings → Authorized domains.
   5. Project settings → Your apps → Web app → copy the config object below.

   While `firebase` is null the portal runs in DEMO mode: everything is stored
   in this browser only and OTP codes are shown on screen. See GO-LIVE.md. */
window.NARI_CONFIG = {
  /* Firebase project: NARI-health (nari-health-33e31). This config is public by design;
     access is controlled by firestore.rules and the authorised domains list, not by these values. */
  firebase: {
    apiKey: 'AIzaSyAgPRGoBa0BH-ru9sMEWY3YFzffDY5gZfo',
    authDomain: 'nari-health-33e31.firebaseapp.com',
    projectId: 'nari-health-33e31',
    storageBucket: 'nari-health-33e31.firebasestorage.app',
    messagingSenderId: '312059255860',
    appId: '1:312059255860:web:48368933885dba395cfe61',
    measurementId: 'G-9V6RCQWJEM'
  },

  /* Firebase JS SDK version to load from Google's CDN (compat build, no bundler needed). */
  firebaseVersion: '12.18.0',

  /* What we call the women who use NARI. Used everywhere in the portal copy. */
  memberWord: 'Member',
  memberWordPlural: 'Members',

  /* Team WhatsApp number in international format, digits only. Used for "Chat with us" links. */
  whatsapp: '916399507521',
  supportEmail: 'trust@narihealth.in',
  phoneCountryCode: '+91',

  /* ===== Payments (Paytm) =====
     The site is static (no server), so payments open Paytm directly with the amount pre-filled:
       • On a phone: a UPI intent link opens the Paytm app with ₹<amount> ready to pay.
       • Elsewhere: the plan's Paytm payment link opens, or the UPI ID is shown to pay manually.
     After paying, the member enters the UPI reference number and the team marks it Paid in the console.

     TO GO LIVE, fill in:
       upiId  — your Paytm for Business UPI ID (Paytm app → Business → Profile, looks like 1234567890@paytm
                or narihealth@paytm). Leave '' to route "Pay" to WhatsApp until you have one.
       plans[].link — optional. Paytm for Business → Payment Links → create one per plan and paste the
                https://paytm.me/... URL. For the monthly auto-debit plan create a SUBSCRIPTION link
                (Paytm Business → Subscriptions); a plain UPI payment cannot set up auto-debit, so
                without this link the first month is taken as a one-time ₹799 and renewals are manual. */
  payments: {
    provider: 'paytm',
    upiId: '7906409321@ptaxis',
    payeeName: 'NARI Health',
    plans: [
      { id: 'sub', label: 'Monthly membership', price: 799, per: '/month', recurring: true, default: true, badge: 'Most popular',
        desc: 'Unlimited consultations with any NARI expert. ₹799 is charged every month. Cancel any time.', days: 30, link: '' },
      { id: 'month', label: '1-month pass', price: 999, per: 'for 30 days', recurring: false,
        desc: 'Unlimited consultations for 30 days. One payment, nothing recurring.', days: 30, link: '' },
      { id: 'single', label: 'Single consultation', price: 199, per: 'one time', recurring: false,
        desc: 'One consultation with one expert. Pay only when you need it.', days: 0, link: '' }
    ]
  },

  /* Consultation modes offered in the booking form. WhatsApp is a support channel,
     not a paid product, so it is deliberately not listed here. Edit prices freely. */
  modes: [
    { id: 'video', label: 'Video consultation', price: '₹199', desc: '25-minute private video call. Free on a membership or pass.' },
    { id: 'clinic', label: 'Clinic visit', price: 'On request', desc: 'In person at a partner clinic near you' }
  ],

  categories: ["Women's Health", 'PCOS', 'Pregnancy', 'Periods', 'Stomach & Digestion', 'Mental Health', 'Nutrition', 'Sleep', 'Menopause', 'General Health', 'Pelvic Health'],
  sources: ['Friend or family', 'Instagram', 'Google search', 'WhatsApp forward', 'Other'],
  slots: ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'],

  /* The experts shown on the website. Admin → Settings → "Add website experts to panel"
     writes these into the live database with one click. */
  seedDoctors: [
    { id: 'doc_sudha', name: 'Dr. Sudha Sharma', role: 'Gynecologist', exp: '32+ yrs', email: 'sudha@narihealth.in', refCode: 'NH-SUDHA', img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/21382c5b8e03d1b3281a7be4d1d609f2.png', categories: ["Women's Health", 'PCOS', 'Pregnancy', 'Periods', 'Menopause'] },
    { id: 'doc_hanifa', name: 'Dr. Hanifa', role: 'Psychologist', exp: '15+ yrs', email: 'hanifa@narihealth.in', refCode: 'NH-HANIFA', img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/39c844c99b0c53eb89ca7bcd29bf7874.png', categories: ['Mental Health', 'Sleep'] },
    { id: 'doc_nisha', name: 'Dr. Nisha Andola', role: 'Physiotherapist', exp: '4 yrs', email: 'nisha@narihealth.in', refCode: 'NH-NISHA', img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/00080d23203e6329660ad5faf6d06897.png', categories: ['Pelvic Health', 'General Health'] },
    { id: 'doc_sneha', name: 'Dr. Sneha Iyer', role: 'Nutritionist', exp: '2 yrs', email: 'sneha@narihealth.in', refCode: 'NH-SNEHA', img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/0a8f90209fff53566c4ee75a308ec234.png', categories: ['Nutrition', 'PCOS', 'Stomach & Digestion', 'General Health'] }
  ]
};
