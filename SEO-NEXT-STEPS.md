# NARI Health: search growth follow-up

Updated 4 October 2026. Changes in this working copy need deployment before Google can see them.

## Implemented

- Weekly membership ₹799/7 days and monthly membership ₹2,499/30 days across the member dashboard, public pages, FAQs and offers. Existing paid legacy plans retain their original 30 days.
- Homepage categories, experts and native FAQ accordions are included in HTML and work without JavaScript.
- Distinct, concise page titles and descriptions; consistent social metadata; updated sitemap modification dates.
- Removed the public-page loading overlay and invisible-by-default content.
- Removed the invalid `Physiotherapy` business type and unverified clinic address markup from service-area pages. Existing specialty and service-area descriptions remain.
- Deleted remote portrait URLs now display explicit placeholders, including existing portal records. This does not restore the missing original photos.

## Restore original portraits

The latest commit `9fe80fc`, its predecessor and the earlier doctor-card commit `a4cfcd2` reference the same Hostinger image URLs. All four returned HTTP 404 on 4 October 2026. No standalone portrait files were found in reachable Git history (including stashes). A code rollback will not recover externally deleted files.

Obtain originals from the old Hostinger project/media library or a backup. Put them in `assets/doctors/`, set each `seedDoctors[].img` in `portal-config.js`, and run `node scripts/sync-doctor-photos.cjs`. The script updates all public doctor cards and image structured data. The portal resolves old Hostinger URLs to the configured replacement without rewriting member data.

## After deployment

1. In the verified `narihealth.in` Search Console property, submit `https://narihealth.in/sitemap.xml`. Inspect the homepage and five service pages; confirm the selected canonical and rendered content, then request indexing for changed pages.
2. Record the last 28 days of clicks, impressions, CTR and average position, compared with the previous 28 days. Export both Queries and Pages, filtered to India, with mobile and desktop comparisons. The supplied private Search Console URL could not be accessed from this session, so no traffic figures or keyword opportunities have been inferred.
3. Prioritize existing pages with relevant impressions and positions near the first page. Use actual query wording to improve their answers, titles and booking information. Review conversions alongside clicks using the existing `lead_submitted` event.
4. Publish accurate clinician profiles with original photos, qualifications, registration details where applicable and services each clinician actually provides. Confirm existing claims such as “50+ experts”, “5,000+ women” and “98% satisfaction” against business records before relying on them as trust signals.
5. Develop distinct, clinician-reviewed service content based on real member questions and Search Console demand. Include named reviewers, review dates and sources for health advice. Do not multiply near-identical city pages or invent clinic addresses.
6. Reassess after several weeks. Improve the pages that attract suitable enquiries; expand content where demand and real service coverage support it.

Google explains that useful, reliable content, crawlable links and clear page descriptions matter, and that changes can take weeks or months to affect search. Rankings and traffic cannot be guaranteed: [Google Search Central SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## Local checks

Run `node tests/site.test.cjs`. It validates current and fallback plans, UPI amounts, payment approval and expiry, legacy entitlements, resumed payment amounts, public links, metadata, FAQ/schema agreement, and JavaScript syntax.

Chrome checks also passed for desktop/mobile layouts, native FAQ interaction, homepage content with JavaScript disabled, and member sign-in using the supplied Firebase test account. The dashboard displayed both new plans and updated the Paytm button when each was selected. No live booking or payment was submitted.
