# Source: user-provided google-ads-audit-account-structure.skill

Reference checklist. Apply the evidence and judgment rules in master.md before using any severity or numerical threshold below.

### ACC — Account structure, bidding & budget

**A. Account-level hygiene**
- [ ] **Auto-applied recommendations** (Recommendations → Auto-apply): list which are on. Auto-applied keyword additions, broad match upgrades, or bid strategy changes not decided by the team = High (Critical if they changed bidding or added irrelevant keywords). Recommend turning off; never turn off yourself.
- [ ] **Optimization score**: note it, but never treat a low score as a finding on its own; Google's recommendations are not an audit standard.
- [ ] **Change history** (Change history, last 30–90 days): match big changes (bid strategy, budget, pausing, new campaigns) against performance shifts. Unexplained drops after a change = finding.
- [ ] **Policy and account status**: disapproved or limited campaigns/ads, billing or verification warnings = Critical if core campaigns are affected.

**B. Campaign settings (every active campaign)**
- [ ] **Location option**: "Presence or interest" instead of "Presence: people in or regularly in your locations" = Critical for local service businesses (pays for clicks outside the service area).
- [ ] **Locations vs service area from intake**: targeted areas too wide, missing, or wrong; missing exclusions where the client does not serve.
- [ ] **Networks**: Search Partners and Display Network enabled on Search campaigns. Display on Search = High; Search Partners = Medium (High if partner traffic spends without converting).
- [ ] **Language**: English (and as relevant). Flag unusual settings.
- [ ] **Ad schedule vs business hours**: ads running when nobody answers phones, for call-driven campaigns = High. Check hour-of-day/day-of-week performance before recommending schedule changes.
- [ ] **Campaign type fit for budget tier**: e.g., PMax or Demand Gen in a Starter tier account starving Search = High.

**C. Structure**
- [ ] **Campaign/ad group organization**: by service line (and residential/commercial where relevant). Flag over-fragmentation (many ad groups with little data each) and over-consolidation (unrelated services sharing one ad group/landing page).
- [ ] **Brand vs non-brand**: brand terms mixed with generic terms distort results. In Scale tier, recommend a separate brand campaign (`Requires client approval` if it is a new campaign).
- [ ] **Keyword match types**: broad match without Smart Bidding and strong negatives = High. Note the keyword-to-search-term relevance (details in the search terms audit).
- [ ] **Duplicate keywords across campaigns/ad groups** (cannibalization).
- [ ] **Naming conventions**: inconsistent names = Low.

**D. Bidding**
- [ ] **Bid strategy vs conversion volume**: Target CPA / Maximize Conversions / Target ROAS with fewer than ~30 conversions in 30 days per campaign or portfolio = High (algorithm lacks data). Suggest a strategy that fits the tier.
- [ ] **Bidding on unreliable conversions**: if the tracking audit found non-lead primary conversions, any conversion-based bidding = Critical (optimizing toward the wrong action).
- [ ] **Learning / limited status**: campaigns stuck in "Learning" or "Limited" for long periods.
- [ ] **Targets realistic**: tCPA far below actual CPA (campaign starves) or no cap on Maximize Clicks (CPCs too high).
- [ ] **Seasonality adjustments**: for seasonal clients (e.g., hurricane season), check whether seasonality adjustments or budget plans exist for expected demand spikes.

**E. Budget**
- [ ] **Limited by budget**: campaigns with "Limited by budget" plus good conversion performance = opportunity (`Requires client approval`).
- [ ] **Search impression share lost to budget vs to rank** (add columns Search IS, Search lost IS (budget), Search lost IS (rank)). Lost to rank → quality/bid issue; lost to budget → budget issue.
- [ ] **Budget distribution**: spend concentrated in low-converting campaigns while converting ones are budget-limited = High. Reallocation that changes total spend = `Requires client approval`; reallocation within the same total = note it as client approval too if the client set campaign budgets.
- [ ] **Spend pacing**: actual monthly spend vs the budget from intake.

**F. Performance Max (if present)**
- [ ] **Channel performance report**: where spend goes (Search, YouTube, Display, Maps, Gmail, Discover). Most spend on Display/YouTube with few leads = High.
- [ ] **Search term insights**: irrelevant categories → campaign-level negative keywords (supported in PMax).
- [ ] **Brand exclusions**: PMax capturing the client's own brand searches that Search would get anyway.
- [ ] **Final URL expansion**: on without page exclusions (sends traffic to careers, blog, about pages) = Medium/High.
- [ ] **Asset groups**: one per service theme, enough assets, audience signals present (customer lists, custom segments based on service searches).
- [ ] **Placement exclusions** (account-level content suitability): low-quality apps/sites.
- [ ] **PMax vs Search overlap**: PMax taking traffic from exact-match Search keywords.

**G. Performance segments**
- [ ] **Geo performance** (Locations report → Where your users were / matched locations, by city/ZIP): areas spending with no conversions over 90 days; clicks from outside the service area.
- [ ] **Device performance**: device with clearly worse cost per conversion.
- [ ] **Auction insights**: new strong competitors, falling overlap/outranking share, top-of-page rate trends.
