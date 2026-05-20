"""
tools/lsa_sync_yearly.py
Fetches monthly Google Guarantee (Local Services Ads) metrics for a given year
and upserts into Supabase sem_yearly_guarantee.

Usage:
  python3 tools/lsa_sync_yearly.py --customer-id 1234567890 --year 2025

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
MICROS           = 1_000_000

MONTH_NAMES = {
    1: 'JANUARY',   2: 'FEBRUARY',  3: 'MARCH',    4: 'APRIL',
    5: 'MAY',       6: 'JUNE',      7: 'JULY',      8: 'AUGUST',
    9: 'SEPTEMBER', 10: 'OCTOBER', 11: 'NOVEMBER', 12: 'DECEMBER',
}

# Load .env from project root
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


def fetch_monthly_campaign_metrics(ga_service, customer_id: str, year: int) -> dict:
    """Monthly spend + impressions from LOCAL_SERVICES campaigns."""
    query = f"""
        SELECT
          segments.month,
          metrics.cost_micros,
          metrics.impressions
        FROM campaign
        WHERE segments.year = {year}
          AND campaign.advertising_channel_type = 'LOCAL_SERVICES'
          AND campaign.status != 'REMOVED'
        ORDER BY segments.month ASC
    """
    monthly = defaultdict(lambda: {'cost_micros': 0, 'impressions': 0})
    try:
        for row in ga_service.search(customer_id=customer_id, query=query):
            month_num = int(str(row.segments.month).split('-')[1])
            monthly[month_num]['cost_micros']  += row.metrics.cost_micros
            monthly[month_num]['impressions']  += row.metrics.impressions
    except Exception as e:
        print(f'[lsa_sync] campaign metrics error: {e}', file=sys.stderr)
    return dict(monthly)


def fetch_monthly_leads(ga_service, customer_id: str, year: int) -> dict:
    """Count of charged leads per month for the given year."""
    query = f"""
        SELECT
          local_services_lead.creation_date_time,
          local_services_lead.lead_charged
        FROM local_services_lead
        WHERE local_services_lead.creation_date_time >= '{year}-01-01 00:00:00'
          AND local_services_lead.creation_date_time < '{year + 1}-01-01 00:00:00'
    """
    monthly_leads = defaultdict(int)
    try:
        for row in ga_service.search(customer_id=customer_id, query=query):
            lead = row.local_services_lead
            if lead.lead_charged:
                dt_str = str(lead.creation_date_time)
                month_num = int(dt_str[5:7])
                monthly_leads[month_num] += 1
    except Exception as e:
        print(f'[lsa_sync] leads error: {e}', file=sys.stderr)
    return dict(monthly_leads)


def upsert_to_supabase(rows: list) -> None:
    import urllib.request

    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL', '')
    service_key  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

    if not supabase_url:
        raise RuntimeError('SUPABASE_URL or VITE_SUPABASE_URL not set')
    if not service_key:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY not set')

    url     = f'{supabase_url}/rest/v1/sem_yearly_guarantee?on_conflict=account_id,year,month'
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
    parser = argparse.ArgumentParser(description='Sync yearly Google Guarantee metrics to Supabase')
    parser.add_argument('--customer-id', required=True, help='Google Ads account ID (digits only)')
    parser.add_argument('--year', type=int, default=datetime.now().year, help='Year to sync (default: current year)')
    args = parser.parse_args()

    customer_id = args.customer_id.replace('-', '')
    if not re.fullmatch(r'\d+', customer_id):
        print('Error: --customer-id must be numeric', file=sys.stderr)
        sys.exit(1)

    year = args.year
    print(f'Syncing {year} Google Guarantee for account {customer_id}...', file=sys.stderr)

    client     = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')

    campaign_metrics = fetch_monthly_campaign_metrics(ga_service, customer_id, year)
    lead_counts      = fetch_monthly_leads(ga_service, customer_id, year)

    rows = []
    for month_num, name in MONTH_NAMES.items():
        cm           = campaign_metrics.get(month_num, {})
        spend        = safe_float(cm.get('cost_micros', 0), MICROS)
        impressions  = int(cm.get('impressions', 0))
        leads        = lead_counts.get(month_num, 0)
        cost_per_lead = round(spend / leads, 2) if leads > 0 else 0.0
        rows.append({
            'account_id':      customer_id,
            'year':            year,
            'month':           name,
            'month_index':     month_num,
            'service':         'Google Guarantee',
            'spend':           spend,
            'leads':           leads,
            'cost_per_lead':   cost_per_lead,
            'ad_impressions':  impressions,
            'top_imp_rate':    0.0,
            'abs_top_imp_rate': 0.0,
        })

    upsert_to_supabase(rows)
    synced = sum(1 for r in rows if r['spend'] > 0 or r['leads'] > 0)
    print(json.dumps({'synced': len(rows), 'months_with_data': synced, 'year': year, 'account_id': customer_id}))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
