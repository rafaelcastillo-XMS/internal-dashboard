import type { Report, Slide } from './types'
import {
  GOOGLE_ADS_KEYWORD_COLUMNS,
  LSA_CREDITED_LEAD_COLUMNS,
  LSA_LEADS_INTRO,
  getGoogleAdsReportData,
  getLsaReportData,
} from './reportData'
import { createHighlightsSummarySlide, normalizeReportSlides } from './reportSlides'

export const REPORT_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const nowIso = () => new Date().toISOString()

export function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function makeReportId(clientId: string, month: string, year: number) {
  const safeClient = clientId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const safeMonth = month.toLowerCase()
  return `${safeClient}-${safeMonth}-${year}-${Date.now()}`
}

export function createSlidesTemplate(clientId: string, clientName: string, month: string, year: number): Slide[] {
  const googleAdsData = getGoogleAdsReportData(clientId, month, year)
  const lsaData = getLsaReportData(clientId, month, year)

  const slides: Slide[] = [
    {
      id: 'cover',
      type: 'cover',
      title: 'Cover',
      order: 1,
      notes: 'Introduce the month, scope, and overall account health.',
      content: {
        reportTitle: 'Google Ads & LSA Report',
        subtitle: `${month} ${year}`,
        textBlocks: [
          {
            id: 'prepared-for',
            label: 'Prepared for',
            value: clientName,
          },
        ],
      },
    },
    {
      id: 'google-ads-key-stats',
      type: 'google_ads_kpis',
      title: 'Google Ads - Key Stats and Performance KPIs',
      order: 3,
      notes: 'Use this slide to summarize Google Ads momentum and month-over-month movement.',
      content: {
        dataSource: {
          source: googleAdsData.source,
          connectionStatus: googleAdsData.connectionStatus,
          integrationTarget: googleAdsData.integrationTarget,
          message: 'Real Google Ads KPI data loads from the Ads account when the report is generated or opened.',
        },
        kpis: googleAdsData.kpis,
        textBlocks: [
          {
            id: 'monthly-summary',
            label: 'Monthly Summary',
            value: googleAdsData.summary,
          },
        ],
      },
    },
    {
      id: 'google-ads-keywords',
      type: 'keywords',
      title: 'Google Ads - Keywords Stats and Performance',
      order: 4,
      notes: 'Highlight both winning keywords and terms that require bid, match type, or negative keyword action.',
      content: {
        dataSource: {
          source: 'mock',
          connectionStatus: 'mock_not_connected',
          integrationTarget: 'Existing SEM Google Ads integration: Supabase Edge Function /sem/performance -> Google Ads keyword_view',
          message: 'Real keyword data loads from Google Ads when the report is generated or opened.',
        },
        tables: [
          {
            id: 'keywords-table',
            title: 'Keyword Performance - Google Ads API',
            columns: GOOGLE_ADS_KEYWORD_COLUMNS,
            rows: [],
          },
        ],
        textBlocks: [
          {
            id: 'keyword-analysis',
            label: 'Keyword Analysis',
            value: 'Real Google Ads keyword data will load from the client Ads account when the report is generated or opened.',
          },
        ],
      },
    },
    {
      id: 'google-ads-ad-performance',
      type: 'ads',
      title: 'Google Ads - Ads Stats and Performance',
      order: 5,
      notes: 'Show top ad themes and describe why they worked.',
      content: {
        ads: [
          {
            id: 'search-ad-1',
            type: 'Search Ad',
            headline: '',
            description: '',
            status: '',
            businessName: '',
            displayUrl: '',
            pathLabels: [],
            metrics: [],
          },
          {
            id: 'pmax-ad-1',
            type: 'Performance Max',
            headline: '',
            longHeadline: '',
            description: '',
            status: '',
            businessName: '',
            displayUrl: '',
            pathLabels: [],
            ctaLabels: [],
            metrics: [],
          },
        ],
        textBlocks: [
          {
            id: 'ad-performance-analysis',
            label: 'Google Ads Analysis',
            value: '',
          },
        ],
      },
    },
    {
      id: 'google-ads-search-terms',
      type: 'search_terms',
      title: 'Google Ads - Search Terms Stats and Performance',
      order: 6,
      notes: 'Use recommendations to document what should be added, excluded, or watched next month.',
      content: {
        tables: [
          {
            id: 'search-terms-table',
            title: 'Search Term Review',
            columns: [
              { key: 'term', label: 'Search term' },
              { key: 'impressions', label: 'Impr.', align: 'right' },
              { key: 'clicks', label: 'Clicks', align: 'right' },
              { key: 'cost', label: 'Cost', align: 'right' },
              { key: 'conversions', label: 'Conv.', align: 'right' },
              { key: 'action', label: 'Action / Recommendation' },
            ],
            rows: [
              { term: 'garage door repair same day', impressions: '1,184', clicks: '74', cost: '$355.42', conversions: '8.0', action: 'Add as exact keyword' },
              { term: 'broken spring repair near me', impressions: '942', clicks: '58', cost: '$281.20', conversions: '6.0', action: 'Add as phrase keyword' },
              { term: 'garage door repair jobs', impressions: '320', clicks: '18', cost: '$76.10', conversions: '0', action: 'Add negative keyword' },
              { term: 'diy garage door opener repair', impressions: '284', clicks: '12', cost: '$44.85', conversions: '0', action: 'Exclude DIY intent' },
              { term: 'emergency garage door repair', impressions: '248', clicks: '21', cost: '$118.90', conversions: '3.0', action: 'Keep monitored' },
              { term: 'garage door opener installation', impressions: '221', clicks: '16', cost: '$92.44', conversions: '2.0', action: 'Review bid coverage' },
              { term: 'commercial garage door repair', impressions: '176', clicks: '11', cost: '$66.32', conversions: '1.0', action: 'Segment if volume grows' },
            ],
          },
        ],
        textBlocks: [
          {
            id: 'search-term-note',
            label: 'Search Term Note',
            value: 'Search term cleanup improved lead quality by removing employment and DIY intent. Add exact match coverage for same-day and spring repair terms.',
          },
        ],
      },
    },
    {
      id: 'devices-day-hour',
      type: 'devices_day_hour',
      title: 'Google Ads - Devices and Day & Hour Stats',
      order: 7,
      notes: 'Summarize timing and device patterns that should influence bids and staffing.',
      content: {
        dataSource: {
          source: 'mock',
          connectionStatus: 'mock_not_connected',
          integrationTarget: 'Existing SEM Google Ads integration: Supabase Edge Function /sem/breakdowns -> Google Ads segments.device, segments.day_of_week, segments.hour',
          message: 'Real device, day, and hour data loads from Google Ads when the report is generated or opened.',
        },
        charts: [
          {
            id: 'device-performance',
            title: 'Devices',
            description: 'Ad performance across devices',
            series: [],
            deviceData: [
              { key: 'MOBILE', label: 'Mobile phones', cost: 0, clicks: 0, conversions: 0 },
              { key: 'TABLET', label: 'Tablets', cost: 0, clicks: 0, conversions: 0 },
              { key: 'DESKTOP', label: 'Computers', cost: 0, clicks: 0, conversions: 0 },
              { key: 'CONNECTED_TV', label: 'TV screens', cost: 0, clicks: 0, conversions: 0 },
            ],
          },
          {
            id: 'day-hour-performance',
            title: 'Day & hour',
            description: 'Your performance by day of week and time of day',
            series: [],
            heatmapData: {
              metric: 'impressions',
              days: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
              hours: Array.from({ length: 24 }, (_, hour) => hour),
              values: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
            },
          },
        ],
        textBlocks: [
          {
            id: 'device-day-hour-analysis',
            label: 'Analysis',
            value: 'Real device, day, and hour data will load from Google Ads when the report is generated or opened.',
          },
        ],
      },
    },
    {
      id: 'lsa-key-results',
      type: 'lsa_key_results',
      title: 'Local Services Ads - Key Results',
      order: 8,
      notes: 'Focus LSA commentary on lead quality, responsiveness, and account trust signals.',
      content: {
        kpis: lsaData.kpis,
        textBlocks: [
          {
            id: 'lsa-summary',
            label: 'LSA Summary',
            value: lsaData.summary,
          },
        ],
      },
    },
    {
      id: 'highlights',
      type: 'highlights',
      title: 'Highlights',
      order: 9,
      notes: 'Document completed optimization work in plain language.',
      content: {
        subtitle: 'Summary of Highlights',
      },
    },
    createHighlightsSummarySlide(10),
    {
      id: 'lsa-account-notes',
      type: 'lsa_notes',
      title: 'LSA Account Notes',
      order: 11,
      notes: 'Review credited Local Services Ads leads for the selected client and month.',
      content: {
        textBlocks: [
          {
            id: 'lsa-leads-intro',
            label: 'Lead Monitoring Summary',
            value: LSA_LEADS_INTRO,
          },
        ],
        tables: [{
          id: 'lsa-credited-leads',
          title: 'Credited leads',
          columns: LSA_CREDITED_LEAD_COLUMNS,
          rows: [],
        }],
      },
    },
    {
      id: 'next-steps',
      type: 'next_steps',
      title: 'Next Step & Recommendations',
      order: 12,
      notes: 'Keep next steps practical and tied to client behavior.',
      content: {
        subtitle: 'Priorities for the Month Ahead',
      },
    },
    {
      id: 'recommendations-content',
      type: 'recommendations',
      title: 'Recommendations',
      order: 13,
      notes: 'Keep recommendations practical and tied to client behavior.',
      content: {
        textBlocks: [
          {
            id: 'client-recommendations',
            label: 'Recommendations',
            value: 'Answer every call promptly. Follow up with leads quickly. Send weekly project photos. Ask satisfied customers for reviews. Continue sharing lead quality feedback so targeting can be refined.',
          },
        ],
      },
    },
    {
      id: 'final-thank-you',
      type: 'thank_you',
      title: 'Final Thank You Slide',
      order: 14,
      notes: 'Close with a concise client-facing message.',
      content: {
        finalMessage: 'Thank you for your business. If you have any questions let us know, we are here to help.',
      },
    },
  ]

  return normalizeReportSlides(slides)
}

export function createReportFromTemplate(input: {
  clientId: string
  clientName: string
  clientLogo?: string
  month: string
  year: number
  status?: Report['status']
}): Report {
  const createdAt = nowIso()
  return {
    id: makeReportId(input.clientId, input.month, input.year),
    clientId: input.clientId,
    clientName: input.clientName,
    clientLogo: input.clientLogo ?? '',
    month: input.month,
    year: input.year,
    status: input.status ?? 'Draft',
    slides: createSlidesTemplate(input.clientId, input.clientName, input.month, input.year),
    createdAt,
    updatedAt: createdAt,
  }
}

export function createSeedReportsForClient(client: {
  id: string
  name: string
  logo?: string
}): Report[] {
  return [
    createReportFromTemplate({
      clientId: client.id,
      clientName: client.name,
      clientLogo: client.logo,
      month: 'June',
      year: 2026,
      status: 'In Review',
    }),
    createReportFromTemplate({
      clientId: client.id,
      clientName: client.name,
      clientLogo: client.logo,
      month: 'May',
      year: 2026,
      status: 'Ready',
    }),
  ].map((report, index) => ({
    ...report,
    id: `${client.id}-sample-${index === 0 ? 'june' : 'may'}-2026`,
    updatedAt: index === 0 ? '2026-06-28T16:30:00.000Z' : '2026-05-31T18:15:00.000Z',
  }))
}
