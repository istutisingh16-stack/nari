# NARI Health — Full SEO Audit Report

**Site:** https://narihealth.in  
**Audit Date:** 2026-05-16  
**Auditor:** Claude Code SEO Audit  

---

## SEO Health Score: 68 / 100

| Category | Weight | Score | Weighted |
|----------|--------|-------|---------|
| Technical SEO | 22% | 62 | 13.6 |
| Content Quality | 23% | 76 | 17.5 |
| On-Page SEO | 20% | 72 | 14.4 |
| Schema / Structured Data | 10% | 15 → 90* | 9.0* |
| Performance (CWV) | 10% | 60 | 6.0 |
| AI Search Readiness | 10% | 25 → 85* | 8.5* |
| Images | 5% | 50 | 2.5 |

*Fixed during this audit session

**Rating: Needs Work** — solid content foundation; critical infrastructure was missing (robots.txt, sitemap, schema). All critical items resolved in this session.

---

## Executive Summary

### Top 5 Issues Found (and Fixed)
1. **No robots.txt** — all crawlers had no instructions; sitemap undiscoverable ✅ Fixed
2. **No sitemap.xml** — Google couldn't discover/prioritize pages ✅ Fixed
3. **No structured data** — zero JSON-LD; missed rich results for MedicalBusiness ✅ Fixed
4. **No llms.txt** — AI crawlers (ChatGPT, Perplexity) had no machine-readable brand info ✅ Fixed
5. **Missing OG image + Twitter card** — social shares rendered with no preview image ✅ Fixed

### Remaining Items (not yet fixed)
- Images served as PNG (Gemini-generated); no WebP, likely large file sizes
- No Google Search Console verified; no CrUX data available
- gallery.html is thin content — set to noindex (done)
- No `apple-touch-icon` for iOS home screen
- Title tag could be more keyword-rich

---

## 1. Technical SEO

### Crawlability
| Check | Result |
|-------|--------|
| robots.txt | ❌ 404 → ✅ Created |
| sitemap.xml | ❌ 404 → ✅ Created |
| Canonical tags | ✅ Present on index, privacy, terms |
| HTML lang attribute | ✅ `lang="en"` on all pages |
| 404 page | ✅ Custom branded 404.html |
| HTTPS | ✅ (GitHub Pages enforces) |
| Mobile viewport | ✅ Present |

### Indexability
| Check | Result |
|-------|--------|
| Meta robots | ✅ No blocking directives on main pages |
| gallery.html | ⚠️ Thin page — set to `noindex, follow` |
| Canonical self-references | ✅ Correct |

### Internal Linking
| Check | Result |
|-------|--------|
| Footer links to privacy/terms | ✅ |
| All nav anchors valid | ✅ Fixed in prior session |
| gallery.html linked from site | ⚠️ Not linked from nav/footer (orphan) |

---

## 2. Content Quality

### E-E-A-T Signals
| Signal | Status |
|--------|--------|
| Women-led expertise stated | ✅ Multiple mentions |
| Specialist types described | ✅ Physiotherapy, psychology, nutrition |
| Credentials mentioned | ⚠️ "Certified physiotherapists", "Licensed psychologists" — no individual names/bios |
| Trust indicators | ✅ "500+ Women Empowered", "100% Confidential", "Verified Specialists" |
| Contact information | ✅ Email + Instagram + WhatsApp |
| Business hours | ✅ Detailed timings in contact section |

### Content Depth
| Section | Word Count | Assessment |
|---------|------------|------------|
| Hero | ~80w | Good — punchy |
| How It Works | ~120w | Good |
| About / Mission | ~200w | Good |
| Plans | ~150w | Good |
| Our Team | ~180w | Good |
| Contact | ~60w | Adequate |

**Overall:** ~800 words on homepage. Adequate for a service landing page. No thin content on main page.

### Keyword Presence
| Target Keyword | Presence |
|----------------|----------|
| women's health | ✅ Multiple |
| physiotherapy | ✅ Multiple |
| psychology | ✅ Multiple |
| nutrition | ✅ Multiple |
| holistic health | ✅ Multiple |
| PCOS | ✅ Mentioned in experts section |
| India / online | ✅ Both mentioned |

**Gap:** "women's physiotherapy India", "online nutrition consultation India" — high-value long-tail not targeted in headings.

---

## 3. On-Page SEO

### Homepage (index.html)
| Element | Content | Assessment |
|---------|---------|------------|
| Title | "NARI \| Women's Holistic Health Platform" | ✅ Good (38 chars) |
| Meta description | "NARI is a women-led holistic health platform..." | ✅ Good (~155 chars) |
| H1 | "NARI is a movement to bring women back to their confidence." | ⚠️ Branded/emotional — no keyword |
| H2 (How) | "How NARI Heals You" | ✅ |
| H2 (About) | "You Are NARI." | ⚠️ No keyword |
| H2 (Plans) | "Simple, Transparent Plans" | ⚠️ No keyword |
| H2 (Team) | "Three disciplines. One integrated team." | ⚠️ No keyword |
| H2 (Contact) | "Start Your Journey Today" | ⚠️ No keyword |
| OG image | ❌ Missing → ✅ Added |
| Twitter card | ❌ Missing → ✅ Added |

**Note:** H2s are intentionally emotional/brand-forward which is valid for a women's health brand. The title tag compensates. Not a critical fix.

### Other Pages
| Page | Title | Meta Desc | Canonical |
|------|-------|-----------|-----------|
| privacy.html | ✅ | ✅ | ✅ |
| terms.html | ✅ | ✅ | ✅ |
| gallery.html | ⚠️ "Gallery — NARI" → Fixed to "Gallery \| NARI Health" | ❌ → ✅ Added | ❌ → ✅ Added |
| 404.html | ✅ | ❌ No meta desc | ❌ No canonical |

---

## 4. Schema / Structured Data

### Before Audit
- ❌ Zero structured data on any page

### After Audit (Added to index.html)
- ✅ `MedicalBusiness` with opening hours, services, email, logo, sameAs
- ✅ `OfferCatalog` with three `MedicalTherapy` offers and pricing
- ✅ `WebSite` with publisher reference
- ✅ `WebPage` with about + description

### Remaining Opportunities
- `FAQPage` schema — add an FAQ section to the page for rich results
- `Review` / `AggregateRating` — once reviews are collected
- `BreadcrumbList` on sub-pages

---

## 5. Performance (Estimated)

### LCP Optimization
| Check | Status |
|-------|--------|
| LCP image has `fetchpriority="high"` | ✅ |
| LCP image has `loading="eager"` | ✅ |
| Google Fonts preconnect | ✅ |
| Font Awesome (render-blocking CDN) | ⚠️ ~30-50ms penalty |
| AOS JS (CDN, deferred?) | ⚠️ Not deferred — blocking |
| EmailJS (CDN, blocking) | ⚠️ Not deferred — blocking |

### Image Optimization
| Image | Format | Alt Text | Lazy Load |
|-------|--------|----------|-----------|
| assets/Gemini_Generated_Image_3j1b8p3j1b8p3j1b.png | PNG | "Woman feeling free and healthy" | `loading="eager"` ✅ |
| assets/Gemini_Generated_Image_we49nzwe49nzwe49.png | PNG | "Indian Female Physiotherapist" | Not set ⚠️ |
| assets/last.png (logo) | PNG | "NARI Logo" | N/A |

**Recommendation:** Convert hero/gallery images to WebP. PNG files from Gemini may be 500KB–2MB; WebP would reduce by 30-50%.

### Third-party Scripts
- Font Awesome (cdnjs) — icons
- Google Fonts (fonts.googleapis.com) — 2 families
- AOS (unpkg) — scroll animations
- EmailJS (jsdelivr) — form submissions

All 4 are render-path resources. Consider loading Font Awesome asynchronously or self-hosting.

---

## 6. AI Search Readiness

| Check | Before | After |
|-------|--------|-------|
| robots.txt (allows AI crawlers) | ❌ | ✅ |
| sitemap.xml | ❌ | ✅ |
| llms.txt | ❌ | ✅ |
| Structured data (MedicalBusiness) | ❌ | ✅ |
| Clear entity definition | ✅ | ✅ |
| Factual, citable content | ✅ | ✅ |
| Brand name + category clarity | ✅ | ✅ |

NARI Health is now AI-crawlable and citable. The `llms.txt` provides machine-readable brand context for ChatGPT, Perplexity, and Bing Copilot indexing.

---

## 7. Images

| Issue | Severity | Fix |
|-------|----------|-----|
| PNG format (should be WebP) | Medium | Convert via Squoosh or ImageMagick |
| gallery image no lazy-load | Low | Add `loading="lazy"` |
| No `width`/`height` on images | Low | Add dimensions to prevent CLS |
| Hero image alt is generic | Low | More specific: "Indian woman practicing wellness with NARI Health" |

---

## Local / Business SEO

NARI operates as online + home visit (Service Area Business). Recommendations:
- Create a **Google Business Profile** for NARI Health (even as SAB with no physical address)
- Add GBP link to website once created
- Collect and display Google reviews
- Add `areaServed: India` — already done in JSON-LD ✅

---

## Pages Crawled

| URL | Status | Indexed? |
|-----|--------|---------|
| https://narihealth.in/ | 200 OK | Yes |
| https://narihealth.in/privacy.html | 200 OK | Yes |
| https://narihealth.in/terms.html | 200 OK | Yes |
| https://narihealth.in/gallery.html | 200 OK | noindex (set) |
| https://narihealth.in/404.html | 200 OK | Likely (minor) |
| https://narihealth.in/robots.txt | 404 → ✅ Created | N/A |
| https://narihealth.in/sitemap.xml | 404 → ✅ Created | N/A |
