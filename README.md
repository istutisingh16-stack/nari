# NARI Health

Static public site with a Firebase member, doctor and admin portal.

## Local preview

Run `npm start` (no dependency install required) and open
<http://localhost:5500/member-login>. Clean URLs and `.html` URLs both work.
If VS Code Live Server already owns port 5500, stop it first, orr run
`PORT=5501 npm start`.

To keep using **VS Code Live Server**, run `npm run prepare:local` once in this
checkout. This creates Git-ignored compatibility redirects for direct clean
URLs. It has already been run in the current workspace. The explicit address
<http://localhost:5500/member-login.html> also works without this preparation.

`routes.js` keeps `.html` in local addresses and rewrites internal links,
including dynamically rendered links, to the actual files. On `narihealth.in`
it preserves clean production URLs. Query strings, referral codes, fragments,
and protected-page login destinations are retained by application links.
Live Server drops query parameters when redirecting a manually entered `/page`
to `/page/`; use the generated `.html` links (or `npm start`) for referral and
return URLs. The built-in preview preserves parameters on direct clean URLs too.
Generated local redirect
directories are not committed or deployed by GitHub Actions.

Local phone sign-in uses Firebase's configured test numbers and test OTPs.
Credentials are not stored in source files. Real SMS sign-in should be checked
on the production domain; see [GO-LIVE.md](GO-LIVE.md).

## Checks

Run `npm test` for payment, WhatsApp workflow, syntax, public-page, URL and HTTP routing tests.
The HTTP tests bind a temporary loopback port.

See [SEO-NEXT-STEPS.md](SEO-NEXT-STEPS.md) for search follow-up and
[B2C-PLAN.md](B2C-PLAN.md) for the proposed early customer and profitability plan.

The WhatsApp consultation menu, native payment requests and admin tracking are
implemented but disabled until account setup and live validation. See
[WHATSAPP-SETUP.md](WHATSAPP-SETUP.md) for prerequisites, deployment and testing.

## Technical SEO

Run `npm run build` after editing routes or public metadata. It validates the
indexable HTML and generates `sitemap.xml` from `routes.js`, excluding pages
marked `noindex`. `npm run check:seo` also verifies that the checked-in sitemap
is current. GitHub Pages runs the build and tests before deploying.

Metadata remains in the HTML so it works without JavaScript. No dependencies or
client-side SEO rendering are required. Sitemap modification dates are omitted
until genuine editorial dates can be maintained; deployment time is not a
content modification date. See [SEO_IMPLEMENTATION_REPORT.md](SEO_IMPLEMENTATION_REPORT.md)
for findings, unchanged business inconsistencies and Search Console actions.
