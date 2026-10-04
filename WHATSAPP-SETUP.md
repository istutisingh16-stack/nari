# WhatsApp consultation orders

Implemented locally, **disabled by default**, not connected or deployed. No
patient messages or real payments have been sent. The mobile Business app alone
cannot run this webhook flow.

## Patient journey

1. Patient messages NARI → three buttons: **One-time ₹199**, **1 week ₹799**,
   **1 month ₹2,499**.
2. Selection → a server-priced order and native WhatsApp **Review and Pay**
   invoice. There is no external payment-link fallback.
3. Payment signal → independent Meta payment lookup checking reference, amount,
   INR currency and successful gateway transaction → Paid in Admin → WhatsApp.
4. A native order-status confirmation is sent in the active messaging window.
   The admin is notified and arranges the consultation in chat.

Weekly/monthly validity starts at verified payment, for 7/30 days. No auto-debit.
Single consultations remain ₹199. Deliver the benefits advertised on the site;
the profitability proposal does not change benefits already purchased.

**Entirely inside WhatsApp has a platform limit:** Meta offers WhatsApp Pay and
may also offer installed UPI apps. The invoice enables UPI and directs patients
to WhatsApp Pay. It cannot force native payment on an ineligible patient/device
or hide every alternative UPI app. Verify the experience before promising it to
all patients.

## Accounts needed

- WhatsApp Business Platform/Cloud API and a registered number. Ask the onboarding
  provider whether your current mobile-app number supports coexistence, including
  native payments, so the team can retain app replies. Do not delete/migrate the
  existing account before confirming chat continuity.
- Native India payments access and a merchant gateway linked in **WhatsApp
  Manager → Payment configurations**. Supported configuration types are Razorpay,
  PayU, BillDesk and Zaakpay. No gateway account is assumed or created here.
- Provider confirmation that NARI's consultation offering is eligible for the
  commerce/payment feature. Messaging access alone does not establish eligibility.
- Meta app access token with permissions for the number, app secret, webhook
  verification token, Business Account ID, phone number ID, payment configuration
  name and supported Graph API version.
- Firebase billing/Cloud Functions enabled for `nari-health-33e31`.

These are external account prerequisites. Keep secrets out of chat, Git and
`portal-config.js`.

## Configure and deploy after onboarding

Merge the non-secret settings from
[`functions/.env.whatsapp.example`](functions/.env.whatsapp.example) into
`functions/.env`, preserving `SITE_URL`. Use the Graph API version currently
supported by your Meta app and the exact payment configuration name.

Store secrets using interactive prompts:

```sh
npx firebase-tools functions:secrets:set WA_ACCESS_TOKEN
npx firebase-tools functions:secrets:set WA_APP_SECRET
npx firebase-tools functions:secrets:set WA_VERIFY_TOKEN
```

Run `npm install` inside `functions/`, then from the repository root deploy the
rules and new functions after configuration:

```sh
npx firebase-tools deploy --only firestore:rules,functions:whatsappWebhook,functions:onWhatsAppEvent,functions:onWhatsAppRecheck,functions:onWhatsAppCustomer,functions:onWhatsAppHelp,functions:onWhatsAppOrder
```

Deploy the website files too. Set `WA_ENABLED=true` and redeploy the three
processing functions when ready for account testing. Until then the webhook
returns 503. Deploy existing push functions by name if WhatsApp secrets are not
set; deploying every function also requires those secrets.

In Meta, set the callback URL below and the same verification token, subscribe
to `messages`, and subscribe the app to the correct WhatsApp Business Account:

`https://asia-south1-nari-health-33e31.cloudfunctions.net/whatsappWebhook`

Use a test number/account first. Configure Firestore TTL on
`whatsappEvents.expireAt` to remove queue/deduplication records after 30 days.
Order/contact retention is separate and needs the business's retention/deletion
process. This automation stores no full chat text, medical reports, payment PINs
or card details.

## Admin workflow

Open **Admin → WhatsApp** (`/admin/console#whatsapp` in production).

- Enquiries show display name, phone, latest inbound time, pause/help state and
  follow-up status. Patients who have not paid remain visible.
- Orders show plan, amount, payment status, order reference, gateway payment ID,
  payment date, weekly/monthly expiry, verified refunds and follow-up status.
- **Open chat** opens the conversation without sending a message.
- **Recheck** requests an authoritative lookup; it does not manually mark paid.
  Failed attempts remain Awaiting payment so patients can retry the invoice.
  An expired invoice is marked Expired only after lookup confirms no successful
  or pending transaction, plus a five-minute settlement grace period.
- New/Contacted/Scheduled/Closed tracks team follow-up. Scheduled does not reserve
  a doctor slot or create an appointment. Agree the actual slot with the patient
  and clinician. Closing a single consultation allows another purchase; paid
  weekly/monthly periods block a new purchase while active.
- Issue refunds through the gateway dashboard, then Recheck. Successful full
  and partial refunds reduce the collected amount. The admin browser cannot
  initiate a refund or edit payment status/amount/reference.

WhatsApp orders are separate from the website's manually verified Paytm records.
This does not create Firebase member accounts, portal entitlements or appointments.
Fulfil these purchases through the WhatsApp team workflow. Linking them to
verified portal accounts is separate work; do not ask a patient to pay again on
the website.

## Failure handling

Raw webhook signatures and business/phone IDs are checked. Events are stored
before acknowledgement; stable IDs prevent duplicate ingestion. Workers retry
temporary errors. Transactions prevent concurrent taps creating multiple bills.
Before creating another bill, a previous pending order is looked up, covering
missed success webhooks. A pending bank transaction blocks replacement even
after the invoice's one-hour checkout lifetime.

A send timeout is ambiguous: the patient might have received the invoice. It is
flagged for review and not automatically resent with a fresh reference. Check
the chat/gateway and use Recheck before any replacement. A persistent Sending
state also needs review. Do not edit payment status to clear a delivery error.

Payment lookup failures leave money unverified and show an admin error. Recover
missed webhooks/refunds with Recheck. There is no scheduled reconciliation in
this version; reconcile daily with the gateway statement, including fees and
settlements outside this display.

HELP pauses plan automation and requests a team reply; STOP pauses automation;
START/MENU resumes it. There are no marketing broadcasts. Old inbound messages
are not automatically answered outside the service window. Late captures still
appear as Paid, with a team-confirmation flag: use an approved utility template
through your provider or wait for a new patient message. Automated out-of-window
templates are not configured here.

## Acceptance checks before collecting money

`npm test` checks the local workflow using simulated Meta responses. It does not
certify account eligibility or live checkout. On the connected test account,
verify all three invoices, native WhatsApp Pay on patient devices, successful
and failed payments, duplicate taps/webhooks, delivery failures, HELP/STOP,
expiry, refunds, admin alerts and missed-webhook Recheck. Compare the gateway's
capture/settlement/refund records. Activate live billing only after account
testing passes; test-mode payments are not real money.

The additional `tests/firestore-whatsapp.test.cjs` checks permissions against a
local Firestore emulator, never the production database. Install test tools
with `npm install --no-save --package-lock=false firebase-tools firebase @firebase/rules-unit-testing`,
then run `npx firebase-tools emulators:exec --project demo-nari-whatsapp --only firestore 'node tests/firestore-whatsapp.test.cjs'`.
Java is required. The default `npm test` does not require these dependencies.

## Primary documentation

- [Meta payment gateway integration](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/pg): native invoices, lookup, status updates, refunds and UPI choices. Uses the current `payment_settings` format.
- [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy): service window, human escalation, privacy and commerce eligibility.
- [Razorpay in-app WhatsApp payments](https://razorpay.com/newsroom/razorpay-launches-in-app-payments-for-whatsapp-business-platform-policybazaar-boat-amongst-early-adopters/): one supported gateway, requiring merchant onboarding.
