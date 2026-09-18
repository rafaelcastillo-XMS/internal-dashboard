export type Accent = 'blue' | 'orange' | 'amber' | 'purple' | 'emerald' | 'red'

export interface SectionDef {
  key: string
  title: string
  assignee: string
  accent: Accent
  icon: string // svg path
  items: string[]
}

const ICONS = {
  shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  text: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h10.5',
  megaphone: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73',
  pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  wrench: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  play: 'M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811z',
}

export const SECTIONS: SectionDef[] = [
  { key: 'content-review', title: 'Website - Content Review', assignee: 'Juliana', accent: 'orange', icon: ICONS.text,
    items: ['Keywords in content', 'Internal linking'] },
  { key: 'google-accounts', title: 'Google Accounts', assignee: 'Juliana', accent: 'blue', icon: ICONS.shield,
    items: ['GA4 active and conversions configured', 'Search Console from domain and verified', 'General status: Clicks, Impressions, CTR, Positioning', 'Google Tag Manager implemented'] },
  { key: 'reviews-reputation', title: 'Reviews & Reputation', assignee: 'Juliana', accent: 'amber', icon: ICONS.megaphone,
    items: ['Interaction (responses, Q&A, services, posts)'] },
  { key: 'gbp', title: 'Google Business Profile', assignee: 'Geraldine', accent: 'blue', icon: ICONS.pin,
    items: ['Active account and access', 'Basic information and categories', 'Updated images', 'Google Maps ranking'] },
  { key: 'offsite-seo', title: 'Off-site SEO - Listings', assignee: 'Geraldine', accent: 'purple', icon: ICONS.link,
    items: ['Presence on Yelp, Bing, Apple Maps', 'NAP consistency', 'Presence on other listings'] },
  { key: 'backlinks-citations', title: 'Backlinks & Citations', assignee: 'Geraldine', accent: 'purple', icon: ICONS.link,
    items: ['Number and quality of backlinks', 'Relevant and error-free citations', 'Number of reviews (GBP, Yelp, Facebook)'] },
  { key: 'tech-seo', title: 'Website - Tech SEO', assignee: 'Steven', accent: 'blue', icon: ICONS.wrench,
    items: ['HTTPS active', 'Mobile responsiveness', 'PageSpeed Insights', 'Errors/warnings/recommendations (Ahrefs)', 'Sitemap.xml', 'Robots.txt', 'Robot Tag', 'Schema', 'Indexing in Google', 'Yoast/General status', 'Review of insecure plugins / outdated software', 'Clickable phone number', 'Active contact form', 'Server name in use', 'Access to CPanel', 'Content review (Low content / Duplicated)', 'HTML hierarchy (H1-H6)'] },
  { key: 'reviews-reputation-steven', title: 'Reviews & Reputation', assignee: 'Steven', accent: 'amber', icon: ICONS.megaphone,
    items: ['Access to Google Business Profile'] },
  { key: 'youtube', title: 'YouTube', assignee: 'Steven', accent: 'red', icon: ICONS.play,
    items: ['Active and optimized channel', 'Videos with keywords, descriptions, and links to website', 'Subscribers'] },
  { key: 'keyword-ranking', title: 'Website - Content Review', assignee: 'Leo', accent: 'emerald', icon: ICONS.chart,
    items: ['MetaKeywords', 'List of target keywords', 'Current ranking (Ahrefs, SEMrush)'] },
]

// Keep the existing storage identity when reassigning the same check.
// Broader old checks are not copied into new, more specific evaluations.
export function itemIdentity(section: string, item: string) {
  if (section === 'reviews-reputation-steven' && item === 'Access to Google Business Profile') {
    return { section: 'google-accounts', item: 'Google Business Profile access' }
  }
  return { section, item }
}

export function rowKey(section: string, item: string) {
  const identity = itemIdentity(section, item)
  return `${identity.section}|${identity.item}`
}

export function previousChecklistRows<T extends { section: string; item: string }>(rows: T[]) {
  const currentKeys = new Set(SECTIONS.flatMap(section => section.items.map(item => rowKey(section.key, item))))
  return rows.filter(row => !currentKeys.has(rowKey(row.section, row.item)))
}
