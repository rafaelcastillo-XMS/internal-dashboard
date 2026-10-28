# Source: user-provided google-ads-audit-ads-assets.skill

Reference checklist. Apply the evidence and judgment rules in master.md before using any severity or numerical threshold below.

### ADS — Ads & assets

**A. Ad coverage and status**
- [ ] Every active ad group has at least one enabled RSA. Ad groups with no active ad = Critical.
- [ ] Disapproved or limited ads and assets, with the policy reason = Critical for core ads, High otherwise.
- [ ] Ad groups with more than 2–3 RSAs splitting little traffic = Low/Medium.

**B. Responsive search ad quality**
- [ ] Number of headlines/descriptions used (aim for 12–15 headlines, 4 descriptions with real variety).
- [ ] **Ad Strength** as a guide, not a goal: Poor/Average is worth improving, but never recommend changes only to reach "Excellent".
- [ ] **Message match**: headlines reflect the ad group's service and the search terms it gets; the landing page delivers the same promise.
- [ ] **Home/Professional Services selling points present** (only if confirmed by the client): service + location, licensed and insured, years in business, reviews/ratings, financing, 24/7 or emergency service, free estimates, guarantees/warranties, residential and/or commercial, clear call to action (Call now, Get a free quote).
- [ ] **Pinning**: excessive pinning (kills combinations) vs useful pinning (brand or compliance line in position 1/2).
- [ ] Spelling, capitalization, repeated headlines, generic copy that could belong to any competitor.
- [ ] Dynamic features used correctly if present (location insertion, keyword insertion with sensible defaults, countdowns).

**C. Asset coverage**
Check at the right level (account / campaign / ad group) and whether they actually serve.
- [ ] **Sitelinks** (4+ with descriptions, pointing to relevant pages, not the homepage repeated).
- [ ] **Callouts** (4+), **Structured snippets** (Services / Types / Brands headers).
- [ ] **Call asset**: present with correct number and schedule matching answering hours. Follow the account manager's call measurement instruction for this client (e.g., Google forwarding number accepted or rejected). Missing call asset in a call-driven business = High.
- [ ] **Location asset** linked to the Google Business Profile, if the client has a physical location/service area profile.
- [ ] **Image assets**, **business logo** and **business name**.
- [ ] **Price** and **Promotion** assets where the client has prices or offers.
- [ ] **Lead form asset**: only if the client wants it and leads are followed up; flag if active but leads are not being downloaded or synced.

**D. Asset and ad performance**
- [ ] Asset performance labels (Learning / Low / Good / Best): replace "Low" assets with enough impressions.
- [ ] Ad-level CTR and conversion rate comparison within ad groups; clear losers kept running for months.
- [ ] Assets that never serve (approved but zero impressions over 90 days).

**E. Automation and testing**
- [ ] **AI Max for Search** (if enabled): check text customization and final URL expansion, and review generated headlines and landing pages chosen. Off-brand or inaccurate generated text, or traffic sent to irrelevant pages = High.
- [ ] Automatically created assets (account-level setting): review what Google generated for accuracy.
- [ ] **Testing cadence**: ads unchanged for 6+ months with no experiments = Medium. Suggest one simple test (e.g., offer-led vs trust-led headlines).
