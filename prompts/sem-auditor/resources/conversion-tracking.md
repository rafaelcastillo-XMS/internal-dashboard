# Source: user-provided google-ads-audit-conversion-tracking.skill

Reference checklist. Apply the evidence and judgment rules in master.md before using any severity or numerical threshold below.

### TRK — Conversion tracking

**A. Conversion actions: is each one a real lead?**
- [ ] List every conversion action: name, source (website, GA4 import, calls, import), category, **primary/secondary**, count (One/Every), value, status (Active, No recent conversions, Inactive, Unverified).
- [ ] **Primary actions that are not leads** (page views, clicks to any page, scroll, engaged sessions, "contact page visit", button clicks without submission) = Critical. They inflate results and train Smart Bidding on the wrong goal.
- [ ] **Real lead actions set as secondary** (not used for bidding/reporting) = High.
- [ ] **Status issues**: "No recent conversions" or "Unverified" on a lead action = Critical if it is the main lead action.
- [ ] **Count setting**: lead forms and calls should normally count "One" per click. "Every" on lead actions = Medium/High (duplicates).
- [ ] **Campaign goals**: campaigns using account-default goals vs campaign-specific goals that exclude real leads.

**B. Double counting**
- [ ] Same event tracked twice (e.g., Google Ads tag form submit + GA4-imported "generate_lead" both primary) = Critical.
- [ ] Thank-you page reloaded/bookmarked causing repeat conversions; conversions far above the number of leads the client reports.
- [ ] Sudden jumps or drops in conversions in the last 90 days that match a website change or tag change.

**C. Tag implementation (website)**
- [ ] Google tag present on all pages (or GTM container present); the conversion event fires only on a real submission/confirmation, not on page load of the form page.
- [ ] GTM: tags, triggers and versions reviewed if access exists; paused or duplicated tags.
- [ ] **Auto-tagging** enabled in Google Ads. Off = Critical (breaks GA4 attribution and offline imports).
- [ ] **GCLID preserved**: redirects or form tools that strip URL parameters.
- [ ] **Enhanced conversions for leads**: on or off; recommend when forms collect email/phone (Medium, High in Scale tier).
- [ ] Consent banner (if any) blocking tags before interaction.

**D. Calls**
- [ ] How calls are measured today: calls from ads (call assets), website calls, clicks on phone numbers, or not at all.
- [ ] If calls are not measured in a call-driven business, record the gap = High. **The recommended solution follows the account manager's instruction for this client** (e.g., Google forwarding numbers only if the client accepts them; otherwise state the gap and the alternative the account manager specifies). Never propose Google forwarding numbers for a client marked as rejecting them.
- [ ] Call conversion minimum duration (e.g., 60 seconds or what the client defines as a lead call); very short durations count spam and wrong numbers.
- [ ] "Click to call" tracked as primary (counts taps, not real calls) = Medium/High.

**E. GA4**
- [ ] GA4 property linked to Google Ads; auto-tagging on; key events defined match real leads.
- [ ] GA4 imports used as primary in Google Ads alongside native tags (double count risk, see B).
- [ ] Large gap between GA4 key events and Google Ads conversions: explain likely causes (attribution, cross-device, double counting).

**F. Attribution and windows**
- [ ] Attribution model: data-driven recommended; last click or deprecated models on lead actions = Medium.
- [ ] Click-through conversion window: fits the sales cycle (e.g., longer for big-ticket services).

**G. Offline conversions (readiness)**
- [ ] If the client uses a CRM, note whether offline conversion import (qualified lead / booked job / sold job) is possible. Recommend it for Scale tier accounts (`Requires client approval`, since it involves the client's systems). If there is no CRM, note it as a future opportunity, Low severity.
