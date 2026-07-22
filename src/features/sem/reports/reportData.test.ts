import { describe, expect, it } from 'vitest'
import { createLsaCreditedLeadsTable } from './reportData'
import type { ReportDataSource } from './types'

describe('createLsaCreditedLeadsTable', () => {
  it('maps only credited Google LSA leads into account-specific table rows', () => {
    const dataSource: ReportDataSource = {
      source: 'lsa_api',
      connectionStatus: 'connected',
      clientId: 'client-1',
      accountId: '1234567890',
      rangeKey: 'monthly_lsa_credited_leads',
      dateRange: { start: '2026-04-01', end: '2026-04-30' },
    }

    const table = createLsaCreditedLeadsTable([
      {
        id: '1',
        phone_number: '+19172173264',
        service_id: 'patio_cover_installation',
        category_id: 'xcat:service_area_business_sunroom_contractor',
        lead_type: 'PHONE_CALL',
        credit_state: 'CREDITED',
        creation_date_time: '2026-04-09 08:09:00',
      },
      {
        id: '2',
        customer_name: 'Pending Lead',
        credit_state: 'PENDING',
        creation_date_time: '2026-04-10 10:00:00',
      },
    ], dataSource)

    expect(table.rows).toEqual([{
      customer: '(917) 217-3264',
      jobType: 'Patio Cover Installation',
      searchIntent: 'Sunroom Contractor',
      location: '—',
      leadType: 'Phone',
      chargeStatus: 'Credited',
      leadReceived: '4/9/26 8:09 AM',
    }])
  })
})
