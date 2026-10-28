# Source: user-provided google-ads-audit-search-terms.skill

Reference checklist. Apply the evidence and judgment rules in master.md before using any severity or numerical threshold below.

### STN — Search terms & negatives

**A. Wasted spend**
- [ ] Sort search terms by cost. Identify terms with spend and zero conversions over 90 days. Quantify the total wasted spend and its % of total spend. Over 15% of spend on clearly irrelevant terms = High; over 30% = Critical.
- [ ] **N-gram analysis**: group terms by repeated single words and two-word phrases (e.g., "jobs", "diy", "free", "cost to", "near me", a city name). Report each n-gram with clicks, cost, conversions. This shows patterns that row-by-row review misses.
- [ ] **Intent classification** for the top-spend terms: high intent (hire/repair/install/quote/emergency), research (how much/cost/vs), irrelevant (jobs, DIY, parts, education, unrelated service). Research terms are not automatically waste: recommend only if they spend without converting.

**B. Client-specific relevance**
- [ ] **Services not offered** (from intake): any spend = High.
- [ ] **Residential vs commercial mismatch**: e.g., commercial/warehouse/industrial searches for a residential-only client (or the reverse).
- [ ] **Out-of-area terms**: city/county names outside the service area in search terms.
- [ ] **Competitor names**: spend on competitor terms. Only a finding if the client did not choose to bid on competitors; note the conversion rate either way.
- [ ] **Brand terms**: share of conversions coming from the client's own brand (inflates non-brand performance if mixed).

**C. Negative keyword setup**
- [ ] Existing negatives at account, campaign and ad group level and shared lists (Tools → Shared library → Exclusion lists). No negatives at all = High.
- [ ] Shared lists created but **not applied** to campaigns = Medium.
- [ ] **Conflicts**: negatives that block active keywords or converting search terms (Google flags some as "conflicting negative keywords") = High.
- [ ] Negative match types: broad negatives that are too aggressive (e.g., blocking "repair" for a repair business).
- [ ] PMax: campaign-level negatives or account-level negatives applied where PMax shows irrelevant categories.

**D. Keyword health (from the search terms angle)**
- [ ] **Close-variant drift**: exact/phrase keywords matching terms with different meaning or service.
- [ ] **Duplicate or competing keywords** across campaigns serving the same term from different ad groups.
- [ ] **Hidden terms**: % of spend in terms not shown (privacy thresholds). Mention it so the account manager knows the visible data is partial.

**E. Opportunities**
- [ ] Converting search terms not yet added as keywords (with match type suggestion).
- [ ] Recurring high-intent themes without a dedicated ad group or landing page (pass to ads/landing page areas).
