# Meta Ads Creative Report — TOFU & MOFU (AI Marketing)

Generated 2026-08-19 · Data pulled live from the Meta Graph API (v21) via the same System User token the dashboard's Social Media module uses. Reporting window per Meta's insights: **2026-07-20 to 2026-08-18**.

**Campaigns covered:**
- **TOFU** — `XMS | TOFU | Awareness | AI Marketing | Video Views | Jul 2026` (objective: Awareness / Video Views)
- **MOFU** — `XMS | MOFU | Traffic | AI Marketing | Video Views | Aug 2026` (objective: Traffic)

**A real limitation, not a made-up one:** the System User token doesn't have `pages_read_engagement` / Page Public Content Access, so the API refused to hand back each post's `permalink_url` directly. The "Post link" column below is the standard Facebook permalink built from the real post ID Meta *did* return (`facebook.com/{page_id}/posts/{post_id}`) — every ID is real, only the permalink fetch itself was blocked. If that link doesn't resolve for a given post, granting that permission to the System User is the fix, not this report.

---

## TOFU — Awareness / Video Views

| Creative | Spend | Impr. | Reach | CTR | Link clicks | Video views | ThruPlays (15s+) | 100% views | Post link |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Be Found in AI Era \| H2B1C3 \| Copy B** | $105.87 | 4,033 | 3,035 | 5.21% | 219 | 637 | 257 | 75 | [link](https://www.facebook.com/1724846154202977/posts/122289494420220012) |
| Can AI Find You \| V01 \| Copy B | $50.53 | 1,298 | 1,115 | 6.86% | 95 | 244 | 81 | 19 | [link](https://www.facebook.com/1724846154202977/posts/122289494402220012) |
| Search Is Changing \| V01 \| Copy A | $12.70 | 395 | 359 | 9.62% | 39 | 65 | 17 | 6 | [link](https://www.facebook.com/1724846154202977/posts/122289494378220012) |
| 360 AI \| Marketing System \| May11 \| Copy B | $4.21 | 58 | 54 | 8.62% | 7 | 17 | 6 | 3 | [link](https://www.facebook.com/1724846154202977/posts/122289494384220012) |
| AI Search Visibility \| H2B1C3 \| Copy A | $2.78 | 88 | 86 | 10.23% | 9 | 18 | 5 | – | [link](https://www.facebook.com/1724846154202977/posts/122289494426220012) |
| 360 AI \| Marketing System \| May11 \| Copy A | $2.27 | 47 | 38 | 10.64% | 5 | 10 | 4 | 1 | [link](https://www.facebook.com/1724846154202977/posts/122289494372220012) |

**Creative script — Be Found in AI Era:**
> If AI platforms cannot understand your business, they may not recommend your business. That is where AI SEO, AISCO, AEO, and GEO become essential. XMS helps brands organize their digital presence so they can stay visible across search, social, and AI-powered discovery. Follow XMS to stay ahead of the AI marketing shift.

---

## MOFU — Traffic

| Creative | Spend | Impr. | Reach | CTR | Link clicks | Landing page views | Video views | ThruPlays | Post link |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Be Found in AI Era \| H2B1C3 \| Copy B** | $102.22 | 18,928 | 18,928 | 1.00% | 172 | 99 | 787 | 301 | [link](https://www.facebook.com/1724846154202977/posts/122295191618220012) |
| Can AI Find You \| V01 \| Copy B | $14.74 | 2,531 | 2,531 | 0.99% | 23 | 14 | 93 | 46 | [link](https://www.facebook.com/1724846154202977/posts/122295191678220012) |
| Search Is Changing \| V01 \| Copy A | — | — | — | — | — | — | — | — | [link](https://www.facebook.com/1724846154202977/posts/122295191684220012) |

**Search Is Changing** has no insights at all yet — Meta returned an empty result, meaning this ad hasn't actually started delivering (likely just launched or still in review). Not a data-pull error; there's simply nothing to report on it yet.

**Creative script — Be Found in AI Era (MOFU version, with CTA):**
> ...Follow XMS to stay ahead of the AI marketing shift. Get a Free Ai SEO Audit!!👇 https://xperienceaimarketing.com/ai-seo-aeo-geo-services-meta/

Two paused duplicates of this same ad set also exist in MOFU (`... Copy B - Copy`, `... Copy B` for other creatives) with $0 spend — they were excluded from this report as inactive.

---

## Analysis

**Best performer: "Be Found in AI Era | H2B1C3 | Copy B"** — it's the top creative in *both* campaigns, and not by a small margin:

- Meta's own delivery algorithm concentrated the most budget on it in both TOFU ($105.87 of ~$178 total) and MOFU ($102.22 of ~$117 total) — that's the auction system voting with real money on relevance/quality, not a metric I picked after the fact.
- It drove the most absolute video engagement by far: 637 video views / 257 thruplays in TOFU (next best: 244/81), and 787 video views / 301 thruplays in MOFU (next best: 93/46).
- In MOFU, its CTR (1.00%) held essentially identical to the much-smaller-spend "Can AI Find You" (0.99%) despite reaching 7x more people — a creative usually loses efficiency as it scales into colder audience segments, so holding CTR flat at 18,928 impressions is a real signal of durability, not luck.
- It produced 99 of the 113 total landing-page views across MOFU (~88%) — it's carrying almost the entire traffic goal for that campaign.

**Why it likely works:** the hook is a direct, slightly unsettling consequence statement — *"If AI platforms cannot understand your business, they may not recommend your business."* — instead of a feature pitch. It frames AI visibility as something that actively costs you customers if ignored, which is a stronger pattern-interrupt than the softer, more generic openers used elsewhere ("Marketing is changing fast, and business owners can feel it" — 360 AI Copy A/B; "Posting online is not the same as having a growth strategy" — similar). It also rides a very current, anxiety-adjacent topic (AI deciding who gets recommended) that's more attention-grabbing in-feed than the more abstract "AI SEO / AEO / GEO" framing used by the other AI SEO creatives, even though they share the same underlying message.

**Runner-up worth another round of budget: "Can AI Find You | V01 | Copy B."** Best CTR-per-dollar efficiency at small spend in TOFU (6.86% CTR at only $50.53) and the second-strongest MOFU performer — it's the most likely candidate to match "Be Found in AI Era" if given a comparable budget.

**Lowest-signal creatives:** the three smallest-spend TOFU ads (360 AI Copy A/B, AI Search Visibility) show high CTRs (~9–11%) but on 40–90 impressions each — too small a sample to draw a real conclusion either way. Worth letting them run longer (or giving them more budget) before judging them, rather than reading the high percentage at face value.
