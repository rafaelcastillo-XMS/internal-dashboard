# Source: user-provided google-ads-audit-landing-pages.skill

Reference checklist. Apply the evidence and judgment rules in master.md before using any severity or numerical threshold below.

### LP — Landing pages

**A. Technical**
- [ ] **Final URLs work**: 404s, redirects, or pages "not found" in ads or sitelinks = Critical.
- [ ] **Mobile speed** (PageSpeed Insights, mobile): poor Core Web Vitals or very slow load on a top-spend page = High.
- [ ] **Mobile usability**: text readable, buttons tappable, no pop-ups covering the page; Google Ads "mobile-friendly click rate" below 100% on key pages.
- [ ] HTTPS, no browser security warnings.
- [ ] Tracking present (cross-check with the tracking area): form leads to a confirmation/thank-you state where conversion fires.

**B. Relevance (message match)**
- [ ] The page matches the ad group's service and the ad's promise (e.g., an ad for "roof repair" goes to a roof repair page, not the homepage). All traffic to the homepage for multiple services = High.
- [ ] Residential vs commercial: page speaks to the right audience for the campaign.
- [ ] Service area visible (cities/counties served) and consistent with targeting.
- [ ] Offers in ads (free estimate, financing, discount) appear on the page.

**C. Conversion elements**
- [ ] **Above the fold on mobile**: headline with the service, clear CTA, tappable phone number (click-to-call), and form or button visible without scrolling.
- [ ] **Form**: short (name, phone, email, service, ZIP/message); long or multi-step forms without reason = Medium/High.
- [ ] One primary goal per page; too many exits (full site navigation, blog links) on a paid landing page = Medium.
- [ ] Phone number on page matches the client's call measurement setup and preference.

**D. Trust**
- [ ] License and insurance mentions, years in business, reviews/ratings or testimonials, real photos of work/team, guarantees/warranties, badges or certifications (only real ones).
- [ ] Missing trust signals on a high-ticket service page = Medium.

**E. Performance by page**
- [ ] Compare conversion rate by landing page (Google Ads landing page report, 90 days). Pages with significant spend and conversion rate far below the account average = High, with likely causes from sections A–D.
