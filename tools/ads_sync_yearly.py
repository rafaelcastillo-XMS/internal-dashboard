"""
tools/ads_sync_yearly.py
Fetches monthly Google Ads metrics for a given year and upserts into Supabase sem_yearly_ads.

Usage:
  python3 tools/ads_sync_yearly.py --customer-id 1234567890 --year 2025

Args:
  --customer-id   Account ID (digits only, no dashes)
  --year          Year to sync, e.g. 2025 (defaults to current year)

Reads from environment:
  ADS_DEVELOPER_TOKEN, ADS_MCC_ID
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Reads OAuth credentials from credentials.json + token.json at project root.

Install deps: pip3 install google-ads requests
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

_ROOT            = Path(__file__).parent.parent
CREDENTIALS_FILE = str(_ROOT / 'credentials.json')
TOKEN_FILE       = str(_ROOT / 'token.json')

# Load .env from project root
_ENV = _ROOT / '.env'
if _ENV.exists():
    for _line in _ENV.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _, _v = _line.partition('=')
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

MICROS = 1_000_000

MONTH_NAMES = {
    1: 'JANUARY', 2: 'FEBRUARY',  3: 'MARCH',    4: 'APRIL',
    5: 'MAY',     6: 'JUNE',      7: 'JULY',      8: 'AUGUST',
    9: 'SEPTEMBER', 10: 'OCTOBER', 11: 'NOVEMBER', 12: 'DECEMBER',
}


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

    config = {
        'developer_token':   developer_token,
        'login_customer_id': mcc_id,
        'client_id':         creds['client_id'],
        'client_secret':     creds['client_secret'],
        'refresh_token':     token['refresh_token'],
        'use_proto_plus':    True,
    }
    return GoogleAdsClient.load_from_dict(config)


def fetch_monthly_metrics(ga_service, customer_id: str, year: int) -> dict:
    """Returns dict keyed by month number (1-12) with aggregated metrics."""
    query = f"""
        SELECT
          segments.month,
          metrics.cost_micros,
          metrics.clicks,
          metrics.conversions,
          metrics.impressions,
          metrics.interactions
        FROM campaign
        WHERE segments.year = {year}
        ORDER BY segments.month ASC
    """
    monthly = defaultdict(lambda: {
        'cost_micros': 0, 'clicks': 0, 'conversions': 0.0,
        'impressions': 0, 'interactions': 0,
    })
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        for row in response:
            # segments.month returns "YYYY-MM-DD" (first day of month)
            month_num = int(str(row.segments.month).split('-')[1])
            m = row.metrics
            monthly[month_num]['cost_micros']  += m.cost_micros
            monthly[month_num]['clicks']       += m.clicks
            monthly[month_num]['conversions']  += float(m.conversions)
            monthly[month_num]['impressions']  += m.impressions
            monthly[month_num]['interactions'] += m.interactions
    except Exception as e:
        print(f'[ads_sync_yearly] monthly metrics error: {e}', file=sys.stderr)
    return dict(monthly)


def fetch_opt_score(ga_service, customer_id: str) -> float:
    """Returns current account-level optimization score (0–100)."""
    query = "SELECT metrics.optimization_score FROM customer"
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        for row in response:
            score = float(row.metrics.optimization_score)
            return round(score * 100, 2)  # API returns 0.0–1.0
    except Exception as e:
        print(f'[ads_sync_yearly] opt_score error: {e}', file=sys.stderr)
    return 0.0


def upsert_to_supabase(rows: list) -> None:
    import urllib.request

    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL', '')
    service_key  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

    if not supabase_url:
        raise RuntimeError('SUPABASE_URL or VITE_SUPABASE_URL not set')
    if not service_key:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY not set')

    url     = f'{supabase_url}/rest/v1/sem_yearly_ads?on_conflict=account_id,year,month'
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
    parser = argparse.ArgumentParser(description='Sync yearly Google Ads metrics to Supabase')
    parser.add_argument('--customer-id', required=True, help='Google Ads account ID (digits only)')
    parser.add_argument('--year', type=int, default=datetime.now().year, help='Year to sync (default: current year)')
    args = parser.parse_args()

    customer_id = args.customer_id.replace('-', '')
    if not re.fullmatch(r'\d+', customer_id):
        print('Error: --customer-id must be numeric', file=sys.stderr)
        sys.exit(1)

    year = args.year
    print(f'Syncing {year} for account {customer_id}...', file=sys.stderr)

    client     = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')

    monthly  = fetch_monthly_metrics(ga_service, customer_id, year)
    opt_score = fetch_opt_score(ga_service, customer_id)

    rows = []
    for month_num, name in MONTH_NAMES.items():
        m = monthly.get(month_num, {})
        cost      = safe_float(m.get('cost_micros', 0), MICROS)
        clicks    = int(m.get('clicks', 0))
        impr      = int(m.get('impressions', 0))
        interact  = int(m.get('interactions', 0))
        conv      = round(float(m.get('conversions', 0.0)), 2)
        ctr       = round(clicks / impr * 100, 4) if impr else 0.0
        avg_cpc   = round(cost / clicks, 4)        if clicks else 0.0
        rows.append({
            'account_id':   customer_id,
            'year':         year,
            'month':        name,
            'month_index':  month_num,
            'service':      'Google Ads',
            'spend':        cost,
            'clicks':       clicks,
            'conversions':  conv,
            'impressions':  impr,
            'ctr':          ctr,
            'avg_cpc':      avg_cpc,
            'interactions': interact,
            'opt_score':    opt_score,  # same score for all months (current snapshot)
        })

    upsert_to_supabase(rows)
    synced = sum(1 for r in rows if r['impressions'] > 0 or r['spend'] > 0)
    print(json.dumps({'synced': len(rows), 'months_with_data': synced, 'year': year, 'account_id': customer_id}))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
