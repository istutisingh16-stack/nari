# NARI Health SEO implementation report

Date: 7 October 2026 (Asia/Kolkata). Changes are local and have not been deployed.

## Scope and UI preservation

The attached SEO brief was implemented within the explicit instruction **“do not change ui at all.”** All changed HTML bodies and inline styles were compared with the original Git version and are byte-for-byte identical. No CSS, browser JavaScript, images, visible copy, navigation, forms, booking flows or layouts changed. No new visible pages were created. Content rewrites, topic hubs, article pages, expert profiles, editorial policy and visible author/reviewer components are deferred because they add/change the UI and require verified editorial input. No hidden keyword text or invisible articles were added as a workaround.

## 1. Repository and existing implementation

- Plain static HTML/CSS/JavaScript; no frontend framework or package dependencies. Firebase powers member/doctor/admin functionality; `functions/` contains backend notification and WhatsApp code.
- `routes.js` lists 17 application routes. Eight are indexable: homepage, five service/location pages, privacy and terms. Gallery is explicitly noindex; member/login/admin/doctor routes are noindex. `404.html` is separate.
- `.github/workflows/static.yml` publishes to GitHub Pages. `firebase.json` configures Firestore/functions, not website hosting. No authoritative production CDN/domain redirect configuration was found.
- Existing titles, descriptions, clean HTTPS canonical tags, Open Graph and Twitter metadata were already present on the six marketing pages. Each of the eight indexable pages already has one H1; visible headings were preserved.
- Homepage categories, expert cards and FAQ answers exist in static HTML. No blog, article system, topic hubs or individual public clinician profile routes exist.
- Existing public pages contain crawlable links to service areas, experts, FAQ and booking. Link/fragment validation passed for all eight indexable pages.
- Existing GA4 ID `G-9V6RCQWJEM`, `lead_form_start`, `lead_submitted` and `lead_fallback_whatsapp` events were preserved. No GTM container was introduced.
- The live homepage was readable through the web tool and broadly matches the local public content. Live robots/sitemap could not be fetched through that tool; direct HTTP checks of domain and URL variants failed because this environment could not resolve the domain. Production status codes and redirect chains remain unverified.

## 2. Implemented technical fixes

### Crawlability / robots.txt

- Explicit `OAI-SearchBot` group allows public pages and repeats private-path exclusions; specific groups do not depend on inheritance from `*`.
- Wildcard group continues allowing Google and other crawlers to access public pages.
- Both groups exclude `/login`, `/member` (including member-login), `/doctor`, `/admin`, `/private/` and `/dashboard/`. Prefix rules also cover directoryless admin/doctor variants and HTML login/member variants.
- Removed the service-worker disallow; rendering resources are not blocked.
- Canonical sitemap declaration retained. No explicit GPTBot preference existed, and none was introduced: its existing wildcard treatment remains.
- These rules do not replace authentication or guarantee deindexing. Existing private-page noindex directives remain. Google must crawl a URL to read a noindex directive; blocked URLs may still appear as URL-only results. See [Google's robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

### Sitemap and reusable validation

- Added dependency-free `scripts/seo.cjs`, `npm run build` and `npm run check:seo`.
- Build derives sitemap entries from actual routes, metadata and canonical tags, excluding every noindex page. No duplicated hand-maintained URL list.
- Eight absolute public URLs are included; no utility pages, parameters, fragments or duplicate HTML variants.
- Omitted legacy hardcoded lastmod dates rather than claiming a fresh editorial review whenever a build runs. This static project has no reliable editorial modification-date model. Future genuine content dates can be added when maintained.
- Removed arbitrary priority/changefreq fields. Static XML is generated at build time; a dynamic HTTP endpoint would add unnecessary infrastructure here.
- Checks cover unique titles/descriptions, one H1, one self-canonical, social metadata consistency, image existence, parseable JSON-LD, duplicate top-level schema IDs, FAQ text agreement, crawlable link destinations/fragments and private-route noindex.
- GitHub Pages workflow builds and tests before artifact upload. Tests also detect a stale checked-in sitemap.

### Canonicalization and indexing

- All eight indexable pages retain `https://narihealth.in/` and clean paths without a trailing slash as their canonical format. Query variants inherit that static canonical.
- Added `noindex, follow` to the 404 document. The existing preview server returns real HTTP 404 for missing routes.
- Gallery remains noindex: it is a single image with no H1 or substantive editorial content.
- Existing `routes.js` history rewriting is not an HTTP redirect. HTTP→HTTPS, www→non-www, `.html`→clean, `/index`→`/` and trailing-slash permanent redirects must be verified/configured at the actual host/CDN. No speculative hosting configuration or redirect loops were introduced. Preserve referral parameters and fragments during any later redirect implementation.

### Structured data and entity consistency

- Replaced the platform's `MedicalBusiness` entities with `MedicalOrganization`, using one stable `https://narihealth.in/#business` identity across six marketing pages. This avoids representing every coverage page as a separate physical clinic.
- Reused public phone/email, logo and the existing Instagram URL. Added ContactPoint. No addresses, ratings, registrations, awards or new social profiles were invented.
- Existing homepage professionals now use Person within the organization's member list, with existing names/roles and an affiliation link. Psychologists, nutritionists and physiotherapists are no longer all labeled Physician. No qualifications or experience claims were added.
- Kept homepage offers and prices intact. Removed unsupported specialty mappings (including Psychiatric as a proxy for psychology), local-business-only payment/price properties and MedicalTherapy objects carrying offers.
- Added Service entities for the five existing service/coverage pages, using each page's current title/description and a provider reference. WebPage mainEntity references the service; about references the shared organization.
- Existing BreadcrumbList markup remains on service pages. No breadcrumb markup was added for nonexistent visible breadcrumbs.
- Existing FAQPage markup remains tied to the displayed answers; all six FAQ sets pass content matching. Do not promise FAQ rich results: Google reports that this feature stopped appearing in Search on 7 May 2026 and removed its documentation in June. See [Search documentation updates](https://developers.google.com/search/updates).
- Added WebPage JSON-LD and full social metadata to privacy/terms. No Article or medical-review claims were published without actual articles and reviewer records.
- Updated `scripts/sync-doctor-photos.cjs` to support the new member list as well as legacy employee lists, preserving the portrait restoration workflow.
- Syntax and local consistency are validated, not a claim of Google rich-result approval. Reference: [Schema.org MedicalOrganization](https://schema.org/MedicalOrganization), [Google structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).

## 3. Files changed and URLs

New files:

- `scripts/seo.cjs`
- `SEO_IMPLEMENTATION_REPORT.md`

Modified HTML (head-only changes):

- `index.html`
- `physiotherapy-bulandshahr.html`
- `physiotherapy-noida.html`
- `physiotherapy-delhi-ncr.html`
- `female-physiotherapist-near-me.html`
- `womens-health-near-me.html`
- `privacy.html`
- `terms.html`
- `404.html`

Other modified files: `robots.txt`, `sitemap.xml`, `package.json`, `tests/site.test.cjs`, `scripts/sync-doctor-photos.cjs`, `.github/workflows/static.yml`, `README.md`.

New public URLs/pages: **none**. Existing sitemap URLs: `/`, `/physiotherapy-bulandshahr`, `/physiotherapy-noida`, `/physiotherapy-delhi-ncr`, `/female-physiotherapist-near-me`, `/womens-health-near-me`, `/privacy`, `/terms`.

## 4. Internal links, local relevance, performance and mobile

- Existing internal links and CTAs are preserved and now checked at build time. No visible anchors/navigation were added.
- Local schema now models coverage through services of one organization rather than implying separate NARI offices. No new cities, addresses or partner locations were asserted. Existing city text is substantially templated and needs future editorial differentiation, subject to the UI constraint and verified coverage.
- No new runtime libraries, scripts, requests or font downloads. Build-only validation adds no browser execution cost. Existing WebP assets, font `display=swap`, lazy expert images and explicit image dimensions remain.
- No runtime performance gain or Core Web Vitals improvement is claimed. Existing legal-page logo images lack width/height; changing their rendering requires a separate visual check. Existing external fonts/icon CSS and large unused image assets warrant later measurement before removal.
- Mobile UI, tap targets, FAQ controls and booking forms are untouched. Body/style equality is stronger evidence for preserving this change's layout than claiming a new responsive redesign. No new browser screenshot or Lighthouse run was performed.

## 5. Analytics and ChatGPT traffic

- Existing GA4 configuration remains. Inspect Traffic acquisition with Session source / medium matching `chatgpt.com` (and any actual UTM sources); do not add ChatGPT to unwanted referrals.
- Existing `traffic.js` stores the external referrer or `utm_source` for the first page of a visit; `chatgpt.com` becomes `chatgpt_com`, while `utm_source=chatgpt` becomes `chatgpt`. Attribution depends on a referrer/UTM being supplied; it cannot recover stripped attribution.
- No new event or fake booking-success signal was added. Existing lead events already measure enquiries. Booking completion tracking needs an agreed successful-booking event and a separate implementation.
- Existing `lead_submitted` includes a concern category. Review whether that health-related event parameter should be sent to analytics; no expanded health data collection was added in this change.
- Existing `llms.txt` was preserved. It is not a substitute for crawling/indexing. Google states llms.txt is not needed for its Search visibility in its [June 2026 documentation update](https://developers.google.com/search/updates).

## 6. Business conflicts and manual decisions

No current production prices were changed. Current designated config in `portal-config.js` and backend WhatsApp pricing agree: ₹199 single / ₹799 for 7 days / ₹2,499 for 30 days. Public marketing pages and llms.txt agree; existing legacy payment amounts in portal code/tests are intentional historical entitlements and must not be overwritten.

| Issue | Locations to review | Decision required |
| --- | --- | --- |
| Terms deny subscriptions/prepaid plans while the site sells memberships | `terms.html`, “Payments and Refunds”; `portal-config.js` payment plans; `index.html` pricing/FAQ/CTA; all five service-page pricing references; `member.html`; `llms.txt` | Approve accurate membership/payment/refund terms. Current checkout values retained. |
| Email differs | `privacy.html` “Who We Are”, “Your Rights”, “Contact Us”; `terms.html` “Contact Us” use `narihealthh@gmail.com`. `portal-config.js`, marketing footers, schemas, doctor portal support and `llms.txt` use `trust@narihealth.in` | Confirm whether both are monitored and which should be authoritative for privacy requests/support. |
| Cancellation timing differs | `terms.html` “Appointments and Cancellations”: at least 24 hours; `member.html` static `bookFine` and its render update: any time before start | Confirm actual cancellation/refund eligibility before editing either. |
| Service scope differs | `terms.html` “About”/“Nature of Services” describes wellness specialists and says no diagnosis/prescribing; homepage/`womens-health-near-me.html`/`portal-config.js` advertise gynaecologist consultations | Confirm platform vs clinician responsibilities and current services. |
| Home-visit availability differs | `privacy.html` “Who We Are” says home visits across India; homepage, five service pages and `llms.txt` constrain in-person coverage to selected partner areas | Confirm exact availability; no new service area was inferred. |
| Confidentiality wording differs | Homepage trust card says only member/expert see bookings; homepage FAQ includes care coordinator; `terms.html` confidentiality says not shared without consent | Review wording against actual authorized care-team access. |
| Unsupported trust claims require records | `index.html`: 5,000+ women, counters, licence verification, testimonials; `member-login.html`: 5,000+; marketing service pages: licence-verified claims; expert cards/config: experience | Verify records, credentials, consent and testimonial provenance before expanding these claims. No ratings/reviews added to schema. |
| Payment methods differed in old schema | Homepage schema: UPI/Paytm/Card; service schemas: UPI/Card/Net banking | Removed these nonessential structured claims; real payment UI and offers remain unchanged. Confirm supported methods before publishing new claims. |

Historical/planning documents also contain illustrative prices (`GO-LIVE.md` bundle/referral ideas, `B2C-PLAN.md` cost examples). These are not current price authorities. The deployment workflow currently uploads the repository root: review an explicit publish allowlist separately so internal planning/report files are not served as website assets. No existing workflow upload scope or application functionality was silently removed here.

## 7. Deferred content and review architecture

Publishing hubs/articles, adding internal-link sections and exposing authors/reviewers would change the visible website. These are intentionally not implemented under the current instruction. There is no fabricated review date, placeholder clinician, claimed editorial process or hidden article schema.

Before future publication, maintain a verified author registry with: stable ID, existing real profile URL, name, role, verified credentials and consented bio/photo. Each article should store slug, title, description, author ID, optional verified reviewer ID, actual published/modified/reviewed dates, source references, relevant service URL and related articles. Render only available verified fields; use internal TODOs for missing records, not public placeholders. Article/Person schema must mirror the visible byline. A policy page must describe an actual operating review process, not one that has not been established.

Future medical content needs sourced, clinician-reviewed direct answers, appropriate red flags, limitations, useful internal links and the existing consultation CTA. Do not guarantee cures or create thin city variants. Existing medical-effectiveness statements in city FAQs should also be reviewed before expanding them.

## 8. Next 30 content opportunities (not created)

Prioritize confirmed service availability, Search Console demand and qualified review. Merge topics when there is insufficient distinct material.

1. `/pcos` — PCOS/PCOD support hub.
2. `/pregnancy` — Pregnancy support hub.
3. `/postpartum` — Postpartum recovery hub.
4. `/menopause` — Menopause support hub.
5. `/pcos/without-medication` — Can PCOS be managed without medication?
6. `/pcos/which-specialist-to-consult` — Which doctor should I consult for PCOS?
7. `/pcos/dietitian-online` — Online PCOS dietitian support in India.
8. `/pcos/exercise` — Exercise options for PCOS.
9. `/postpartum/when-to-start-physiotherapy` — When should physiotherapy start after delivery?
10. `/postpartum/c-section-recovery` — Physiotherapy after C-section.
11. `/postpartum/diastasis-recti` — Understanding diastasis recti and assessed exercise.
12. `/postpartum/pelvic-floor` — What is pelvic floor physiotherapy?
13. `/menopause/which-specialist-to-consult` — Who to consult for menopause symptoms.
14. `/pcos/care-team` — Gynaecologist, dietitian and physiotherapist roles.
15. `/pcos/symptoms` — Symptoms and when to seek assessment.
16. `/pcos/nutrition` — Practical PCOS nutrition questions.
17. `/pcos/weight-management` — Individualized weight-management support.
18. `/pcos/fertility` — Fertility questions and referral pathways.
19. `/pcos/mental-health` — Emotional wellbeing and PCOS.
20. `/pregnancy/exercise` — Exercise considerations during pregnancy.
21. `/pregnancy/back-pain` — Pregnancy back pain and assessment.
22. `/pregnancy/pelvic-pain` — Pregnancy pelvic pain.
23. `/pregnancy/nutrition` — Pregnancy nutrition support.
24. `/pregnancy/mental-wellness` — Mental wellbeing during pregnancy.
25. `/postpartum/back-pain` — Back pain after delivery.
26. `/postpartum/return-to-exercise` — Returning to exercise after delivery.
27. `/menopause/bone-health` — Bone-health questions and professional support.
28. `/menopause/strength-training` — Strength training through menopause.
29. `/menopause/sleep` — Sleep concerns around menopause.
30. `/menopause/nutrition` — Nutrition during the menopause transition.

## 9. Validation and limitations

- `npm run build`: passed, generated eight canonical sitemap entries.
- `npm test`: 30 existing tests passed (11 site/payment/syntax, 6 routing/HTTP, 13 WhatsApp), followed by SEO validation for all eight indexable pages.
- Initial restricted run could not bind a loopback port (`EPERM`); rerun with approved loopback access passed. This was an execution restriction, not a routing failure.
- `git diff --check`: passed.
- Body and inline-style byte comparisons passed for every modified HTML page; no CSS/runtime JS/image changes.
- No lint or TypeScript type-check task exists. Existing tests parse JavaScript and JSON-LD. New/modified Node tooling is syntax-checked separately.
- Firestore emulator integration test is outside the normal npm suite and was not run; no backend or security rules changed.
- No authenticated Search Console/GA4 data, live redirect verification, clinical credential verification, field Web Vitals or deployment was available/performed. Rankings, AI citations and rich-result eligibility are not guaranteed.

## 10. Five manual Google Search Console actions

Perform these after deploying the reviewed changes:

1. Open/verify the `narihealth.in` Domain property, covering HTTPS and host variants.
2. Submit `https://narihealth.in/sitemap.xml` under Sitemaps and confirm successful fetch with the eight intended URLs.
3. Use URL Inspection and Test Live URL on the homepage and five service pages. Check crawl access, rendered content and declared/Google-selected canonical; request indexing for changed public URLs.
4. Review Page indexing and Crawl stats for blocked public URLs, duplicate canonical variants, soft 404s and server errors. Investigate unwanted indexed utility URLs without submitting login/admin pages for indexing.
5. Export Search results performance for the last 28 days versus the previous period, split by landing page/query and India/mobile. Record a baseline and review after recrawling; prioritize relevant demand over page-count expansion.
