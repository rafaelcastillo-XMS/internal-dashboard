"""
Fetches Google Ads device, day-of-week, and hour breakdowns for one account.

Args:
  --customer-id  CUSTOMER_ID   Account ID (digits only, no dashes)
  --start        YYYY-MM-DD
  --end          YYYY-MM-DD

Reads ADS_DEVELOPER_TOKEN and ADS_MCC_ID from environment.
Reads OAuth credentials from credentials.json + token.json at project root.
"""

import argparse
import json
import re
import sys

from ads_fetch import MICROS, get_ads_client, safe_float


_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_ID_RE = re.compile(r'^\d+$')


def validate_inputs(customer_id: str, start: str, end: str) -> None:
    if not _ID_RE.match(customer_id):
        raise ValueError(f'Invalid customer_id: {customer_id!r}')
    if not _DATE_RE.match(start) or not _DATE_RE.match(end):
        raise ValueError(f'Invalid date range: {start!r} - {end!r}')


def row_payload(row, key, label=None):
    metrics = row.metrics
    payload = {
        'key': key,
        'impressions': int(metrics.impressions),
        'clicks': int(metrics.clicks),
        'cost': safe_float(metrics.cost_micros, MICROS),
        'conversions': safe_float(metrics.conversions),
    }
    if label:
        payload['label'] = label
    return payload


def fetch_segment(ga_service, customer_id: str, start: str, end: str, segment: str) -> list:
    validate_inputs(customer_id, start, end)
    query = f"""
        SELECT
          {segment},
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
    """
    rows = []
    response = ga_service.search(customer_id=customer_id, query=query)
    for row in response:
        if segment == 'segments.device':
            rows.append(row_payload(row, row.segments.device.name))
        elif segment == 'segments.day_of_week':
            rows.append(row_payload(row, row.segments.day_of_week.name))
        elif segment == 'segments.hour':
            rows.append(row_payload(row, int(row.segments.hour)))
    return aggregate_rows(rows)


def aggregate_rows(rows: list) -> list:
    grouped = {}
    for row in rows:
        key = str(row['key'])
        current = grouped.setdefault(key, {
            'key': row['key'],
            'impressions': 0,
            'clicks': 0,
            'cost': 0,
            'conversions': 0,
        })
        current['impressions'] += row['impressions']
        current['clicks'] += row['clicks']
        current['cost'] = round(current['cost'] + row['cost'], 2)
        current['conversions'] = round(current['conversions'] + row['conversions'], 2)
    return list(grouped.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--customer-id', required=True)
    parser.add_argument('--start', required=True)
    parser.add_argument('--end', required=True)
    args = parser.parse_args()

    customer_id = args.customer_id.replace('-', '')
    validate_inputs(customer_id, args.start, args.end)

    client = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')

    print(json.dumps({
        'devices': fetch_segment(ga_service, customer_id, args.start, args.end, 'segments.device'),
        'days': fetch_segment(ga_service, customer_id, args.start, args.end, 'segments.day_of_week'),
        'hours': fetch_segment(ga_service, customer_id, args.start, args.end, 'segments.hour'),
        'dateRange': {'start': args.start, 'end': args.end},
    }, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
