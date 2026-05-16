# NARI Health — SEO Action Plan

**Generated:** 2026-05-16  

---

## ✅ Completed in This Session

| # | Item | Category | Impact |
|---|------|----------|--------|
| 1 | Created `robots.txt` | Technical | Critical |
| 2 | Created `sitemap.xml` | Technical | Critical |
| 3 | Created `llms.txt` | AI Readiness | High |
| 4 | Added JSON-LD structured data (MedicalBusiness, WebSite, WebPage) | Schema | High |
| 5 | Added `og:image` to index.html | On-Page | High |
| 6 | Added Twitter card meta tags | On-Page | Medium |
| 7 | Added `og:locale: en_IN` | On-Page | Low |
| 8 | Fixed gallery.html: title, meta desc, canonical, noindex | Technical | Medium |

---

## Remaining Priorities

### Critical (Fix within 1 week)

None remaining — all P0 issues resolved.

---

### High (Fix within 2 weeks)

#### H1. Submit sitemap to Google Search Console
**Action:** Go to search.google.com/search-console → Add property `narihealth.in` → Sitemaps → Submit `https://narihealth.in/sitemap.xml`  
**Why:** Even with sitemap.xml live, manual submission accelerates indexing by days.

#### H2. Convert images to WebP
**Action:** Run hero image + gallery image through [Squoosh](https://squoosh.app/) or use `cwebp`:
```bash
cwebp assets/Gemini_Generated_Image_3j1b8p3j1b8p3j1b.png -o assets/hero.webp -q 82
cwebp assets/Gemini_Generated_Image_we49nzwe49nzwe49.png -o assets/team.webp -q 82
```
Update `src` in HTML to `.webp` files.  
**Why:** PNG images from Gemini are typically 1–3MB. WebP at quality 82 is ~300KB. Improves LCP by 0.5–1.5s.

#### H3. Defer non-critical scripts
**Action:** Add `defer` or load asynchronously:
```html
<!-- Before close of </body>, replace current: -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js" defer></script>
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js" defer></script>
```
**Why:** Both EmailJS and AOS are currently render-blocking. Deferring saves ~100–200ms on FCP.

#### H4. Add image dimensions to prevent CLS
**Action:** Add `width` and `height` attributes to `<img>` tags in index.html hero and gallery images.  
**Why:** Without dimensions, the browser can't reserve space, causing layout shift (bad CLS score).

---

### Medium (Fix within 1 month)

#### M1. Add FAQ section with FAQPage schema
**Action:** Add a "Common Questions" section to index.html with 4–6 Q&As about PCOS physio, online sessions, pricing, etc. Include `FAQPage` JSON-LD.  
**Why:** FAQ rich results appear in Google SERPs, increasing click-through rate by 20–30%. High opportunity for "online women physiotherapy India" queries.

**Suggested questions:**
- "Do I need a referral to see a NARI specialist?"
- "Can I book a session from outside India?"
- "What is a free assessment?"
- "How is NARI different from a regular clinic?"
- "Can NARI help with PCOS symptoms?"

#### M2. Create Google Business Profile
**Action:** Go to business.google.com → Create profile as a "Service Area Business" → Select area: India → Category: Women's Health Clinic / Physical Therapist.  
**Why:** GBP shows NARI in Maps and local packs for "women's health platform India" searches. Free and high ROI.

#### M3. Self-host Font Awesome (or use SVG icons)
**Action:** Download Font Awesome Free and serve from `assets/fontawesome/`. Update CSS link.  
**Why:** CDN dependency adds DNS lookup + connection time. Self-hosting eliminates ~80ms latency per page load.

#### M4. Add `apple-touch-icon`
**Action:** Create a 180×180px PNG of the NARI logo and add to `<head>`:
```html
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
```
**Why:** Without this, iOS home screen adds a blurry screenshot instead of the logo when users "Add to Home Screen."

#### M5. Fix gallery.html — make it a proper team page or remove
**Action:** Either (a) build out gallery.html as a real "Our Team" page with specialist profiles, or (b) redirect it to the main page's `#experts` section.  
**Why:** Currently set to noindex because it's thin. A real team page with bios would support E-E-A-T signals significantly.

---

### Low (Backlog)

#### L1. Add `meta name="description"` to 404.html
Minor: 404 pages rarely rank but having a meta desc is good hygiene.

#### L2. Improve hero H1 keyword density
Current: "NARI is a movement to bring women back to their confidence."  
Suggested: Consider testing "Women's Holistic Health: Physiotherapy, Psychology & Nutrition" as H1 with the emotional tagline as a subheading.  
**Caveat:** Current H1 is strong brand copy. Only change if organic traffic KPIs matter more than brand expression.

#### L3. Add `hreflang` if Hindi version added later
If a Hindi-language version is ever created, add `hreflang="hi"` and `hreflang="en"` tags.

#### L4. Add `rel="preload"` for hero image
```html
<link rel="preload" as="image" href="/assets/hero.webp" fetchpriority="high">
```
Shaves ~100ms off LCP on slow connections.

#### L5. Set up Google Analytics 4
Track organic traffic, form completions, and conversion rates. Essential for measuring SEO progress.

---

## Keyword Opportunities

| Keyword | Monthly Volume (est.) | Difficulty | Priority |
|---------|-----------------------|------------|----------|
| women's physiotherapy India | 500–1K | Medium | High |
| online nutrition consultation India | 1K–3K | Medium | High |
| PCOS physiotherapy online | 200–500 | Low | High |
| holistic health platform India | 100–300 | Low | Medium |
| women's health psychologist India | 300–500 | Medium | Medium |
| cycle syncing nutritionist | 100–300 | Low | Medium |

**Recommendation:** Create individual service pages (physiotherapy, psychology, nutrition) to target these long-tail keywords. Each page can rank independently and link back to the homepage.

---

## 30-Day SEO Roadmap

| Week | Actions |
|------|---------|
| Week 1 | Submit sitemap to GSC, Convert images to WebP, Defer scripts |
| Week 2 | Add FAQ section + FAQPage schema, Create Google Business Profile |
| Week 3 | Add apple-touch-icon, Fix gallery → team page |
| Week 4 | Set up GA4, Begin content for first service sub-page |
