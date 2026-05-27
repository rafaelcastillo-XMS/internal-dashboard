"""
tools/ads_sync_daily.py
Fetches daily Google Ads metrics for a date range and upserts into sem_ads_daily.

Usage:
  python3 tools/ads_sync_daily.py --customer-id 1234567890 --start-date 2025-05-01 --end-date 2025-05-31

Args:
  --customer-id   Account ID (digits only, no dashes)
  --start-date    Start date YYYY-MM-DD (defaults to first day of current month)
  --end-date      End date YYYY-MM-DD (defaults to today)

Reads from environment: ADS_DEVELOPER_TOKEN, ADS_MCC_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Reads OAuth credentials from credentials.json + token.json at project root.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, date
from pathlib import Path

_ROOT            = Path(__file__).parent.parent
CREDENTIALS_FILE = str(_ROOT / 'credentials.json')
TOKEN_FILE       = str(_ROOT / 'token.json')
MICROS           = 1_000_000

_ENV = _ROOT / '.env'
if _ENV.exists():
    for _line in _ENV.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _, _v = _line.partition('=')
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))


def safe_float(value, divisor=1):
    try:
        n = float(value)
        return round(n / divisor, 4) if divisor else 0.0
    except (TypeError, ValueError):
        return 0.0


def get_ads_client():
    from google.ads.googleads.client import GoogleAdsClient

    developer_token = os.environ.get('ADS_DEVELOPER_TOKEN', '')
    mcc_id          = os.environ.get('ADS_MCC_ID', '').replace('-', '')

    if not developer_token:
        raise RuntimeError('ADS_DEVELOPER_TOKEN not set')
    if not mcc_id:
        raise RuntimeError('ADS_MCC_ID not set')

    with open(CREDENTIALS_FILE) as f:
        raw = json.load(f)
    creds = raw.get('installed') or raw.get('web')

    with open(TOKEN_FILE) as f:
        token = json.load(f)

    return GoogleAdsClient.load_from_dict({
        'developer_token':   developer_token,
        'login_customer_id': mcc_id,
        'client_id':         creds['client_id'],
        'client_secret':     creds['client_secret'],
        'refresh_token':     token['refresh_token'],
        'use_proto_plus':    True,
    })


def fetch_daily_metrics(ga_service, customer_id: str, start_date: str, end_date: str) -> dict:
    """Returns dict keyed by date string (YYYY-MM-DD) with aggregated metrics."""
    query = f"""
        SELECT
          segments.date,
          metrics.cost_micros,
          metrics.clicks,
          metrics.conversions,
          metrics.impressions,
          metrics.interactions
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
        ORDER BY segments.date ASC
    """
    daily = defaultdict(lambda: {
        'cost_micros': 0, 'clicks': 0, 'conversions': 0.0,
        'impressions': 0, 'interactions': 0,
    })
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        for row in response:
            day = str(row.segments.date)  # YYYY-MM-DD
            m = row.metrics
            daily[day]['cost_micros']  += m.cost_micros
            daily[day]['clicks']       += m.clicks
            daily[day]['conversions']  += float(m.conversions)
            daily[day]['impressions']  += m.impressions
            daily[day]['interactions'] += m.interactions
    except Exception as e:
        print(f'[ads_sync_daily] error: {e}', file=sys.stderr)
    return dict(daily)


def upsert_to_supabase(rows: list) -> None:
    import urllib.request

    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL', '')
    service_key  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

    if not supabase_url:
        raise RuntimeError('SUPABASE_URL or VITE_SUPABASE_URL not set')
    if not service_key:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY not set')

    url     = f'{supabase_url}/rest/v1/sem_ads_daily?on_conflict=account_id,date'
    payload = json.dumps(rows).encode()
    req     = urllib.request.Request(
        url,
        data=payload,
        method='POST',
        headers={
            'apikey':        service_key,
            'Authorization': f'Bearer {service_key}',
            'Content-Type':  'application/json',
            'Prefer':        'resolution=merge-duplicates',
        },
    )
    with urllib.request.urlopen(req) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f'Supabase upsert failed: {resp.status} {resp.read()}')


def main():
    today      = date.today()
    month_start = today.replace(day=1).isoformat()

    parser = argparse.ArgumentParser(description='Sync daily Google Ads metrics to Supabase')
    parser.add_argument('--customer-id',  required=True,              help='Google Ads account ID (digits only)')
    parser.add_argument('--start-date',   default=month_start,        help='Start date YYYY-MM-DD (default: first of current month)')
    parser.add_argument('--end-date',     default=today.isoformat(),  help='End date YYYY-MM-DD (default: today)')
    args = parser.parse_args()

    customer_id = args.customer_id.replace('-', '')
    if not re.fullmatch(r'\d+', customer_id):
        print('Error: --customer-id must be numeric', file=sys.stderr)
        sys.exit(1)

    print(f'Syncing {args.start_date} → {args.end_date} for account {customer_id}...', file=sys.stderr)

    client     = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')

    daily = fetch_daily_metrics(ga_service, customer_id, args.start_date, args.end_date)

    rows = []
    for day, m in daily.items():
        spend = safe_float(m['cost_micros'], MICROS)
        rows.append({
            'account_id':   customer_id,
            'date':         day,
            'spend':        spend,
            'clicks':       int(m['clicks']),
            'conversions':  round(float(m['conversions']), 2),
            'impressions':  int(m['impressions']),
            'interactions': int(m['interactions']),
        })

    if rows:
        upsert_to_supabase(rows)

    print(json.dumps({
        'synced': len(rows),
        'start_date': args.start_date,
        'end_date': args.end_date,
        'account_id': customer_id,
    }))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
