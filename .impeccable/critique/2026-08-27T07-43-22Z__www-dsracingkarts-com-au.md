---
target: DS Racing Karts site (home, shop, product, cart, checkout)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-08-27T07-43-22Z
slug: www-dsracingkarts-com-au
---
# Design critique - DS Racing Karts

Method: dual-agent (A design review, B detector+evidence, isolated)

## Design Health Score: 20/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No positive "in stock" state; 2s green flash after Add to Cart, no route to cart |
| 2 | Match System / Real World | 3 | "Create invoice & pay"; Square title-casing mangles brands |
| 3 | User Control and Freedom | 2 | "-" at qty 1 silently deletes; cart cleared before Square redirect |
| 4 | Consistency and Standards | 2 | White header on black site; brand-red vs racing-red duplicate tokens |
| 5 | Error Prevention | 1 | No confirms, no inline validation, no in-stock filter |
| 6 | Recognition Rather Than Recall | 2 | sr-only checkout labels; 89 flat category buttons |
| 7 | Flexibility and Efficiency | 3 | Cmd+K and SKU search are excellent but stranded on /shop |
| 8 | Aesthetic and Minimalist Design | 2 | 3 promo blocks above search; price printed twice |
| 9 | Error Recovery | 1 | Bare "Payment failed" text, no guidance or phone |
| 10 | Help and Documentation | 2 | Product page links to no help; shipping never disclosed |

## Design Specificity

Authored at the decoration layer, generic at the structure layer. Real motifs:
chequered conic-gradient dividers, SVG tachometer bound to live product count,
technical-drawing corner brackets, canvas racing game. Generic and damaging:
no product on the home page, no search outside /shop.

Detector: 7 findings, only 1 on public surfaces (bounce-easing, HeroVideo:240).
3 false positives (Arial in email templates). 3 true-but-admin-only.
Detector blind spot: missed Inter as brand face because it only reads literal
font-family strings, not next/font/google imports.

## Priority Issues

P0 - 64.9% of catalogue shows "Contact for ETA" and the data is stale.
  Verified: 8,423 sellable products, 5,466 unbuyable (64.9%).
  9,612 inventory rows, only 10 updated in 7 days.
  Full reconcile never ran (cron GET vs POST). Re-measure after a resync
  BEFORE any design change. Add in-stock filter + availability sort if it holds.
  Replace dead-end contact link with /contact?subject=&message= prefill
  (already supported, currently unused).

P0 - No search outside /shop; no product on home page.
  Lift SearchAutocomplete into Header. Add in-stock product strip to home.

P1 - Checkout total is not the total; abandoning Square destroys the cart.
  checkout/page.tsx:52-56 clears cart before redirect.
  Shipping quoted after payment. ACL single-price exposure - flag, don't advise.

P2 - Product pages too thin; price printed twice on single-variation products.
  No zoom, no fitment, no related, no returns link.

P3 - Craft debt: Inter as brand face (banned), eyebrow device x55 across 18
  files, carbon-bg/checkered-bg classes do not exist (8 usages render flat),
  focus ring 1.63:1 (needs 3:1), no :focus-visible, no skip link.

## Persona Red Flags

Casey (mobile): two adverts and a warning before the search box; cookie banner
covers the checkout submit.
Riley (stress): "-" deletes without undo; back from Square = empty cart.
Sam (a11y): placeholder-only labels at 3.27:1; focus ring 1.63:1; category
buttons 3.46:1; no skip link.
Dave (club racer, trackside): product page cannot answer "is it in stock";
Contact is not in the nav, Sponsors is.

## Minor Observations

Three agency credits incl. header pill on /checkout. Unsourced stats
(40 Years, 1000+, 48 Tracks). "8000+ Parts Available" misleading at 65%
unavailable. Hero video 3.69MB/7.1s, silent audio track, no poster, content
opacity-0 for ~8.5s on desktop. 5 homepage images still on Square S3 not
Cloudinary. No fetchpriority=high. /shop 280KB HTML, category tree inlined
twice, h1 -> h3 with no h2. Good: prefers-reduced-motion thorough; 100dvh
correctly used on hero.
