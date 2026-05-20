"""
tools/lsa_test.py
Tests access to Google Guarantee (Local Services Ads) data via the Google Ads API.

Run:
  python3 tools/lsa_test.py
"""

import json, os, sys
from datetime import date, timedelta
from pathlib import Path

# ── Load .env from project root ───────────────────────────────────────────────
_ROOT = Path(__file__).parent.parent
_ENV  = _ROOT / '.env'

if _ENV.exists():
    for line in _ENV.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, _, v = line.partition('=')
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

# ── Check token ───────────────────────────────────────────────────────────────
TOKEN_FILE       = str(_ROOT / 'token.json')
CREDENTIALS_FILE = str(_ROOT / 'credentials.json')
MICROS           = 1_000_000

if not os.path.exists(TOKEN_FILE):
    print('No token.json found. Run this first:')
    print('  python3 tools/auth.py')
    sys.exit(1)


def get_ads_client():
    from google.ads.googleads.client import GoogleAdsClient

    developer_token = os.environ.get('ADS_DEVELOPER_TOKEN', '')
    mcc_id          = os.environ.get('ADS_MCC_ID', '').replace('-', '')

    if not developer_token:
        raise RuntimeError('ADS_DEVELOPER_TOKEN not set in .env')
    if not mcc_id:
        raise RuntimeError('ADS_MCC_ID not set in .env')

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


def main():
    client     = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')
    mcc_id     = os.environ['ADS_MCC_ID'].replace('-', '')

    # ── Step 1: list all sub-accounts ─────────────────────────────────────────
    print('Fetching accounts under MCC...')
    acct_query = """
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.status,
          customer_client.manager
        FROM customer_client
        WHERE customer_client.level <= 1
          AND customer_client.manager = false
    """
    accounts = []
    for row in ga_service.search(customer_id=mcc_id, query=acct_query):
        cc  = row.customer_client
        cid = cc.client_customer.split('/')[-1]
        accounts.append({
            'id':     cid,
            'name':   cc.descriptive_name or f'Account {cid}',
            'status': cc.status.name,
        })

    print(f'  Found {len(accounts)} account(s)\n')

    # ── Step 2: search LOCAL_SERVICES campaigns in each account ───────────────
    end   = date.today()
    start = end - timedelta(days=30)
    lsa_accounts = []

    for acct in accounts:
        cid = acct['id']
        query = f"""
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type,
              metrics.cost_micros,
              metrics.impressions,
              metrics.clicks
            FROM campaign
            WHERE campaign.advertising_channel_type = 'LOCAL_SERVICES'
              AND segments.date BETWEEN '{start}' AND '{end}'
              AND campaign.status != 'REMOVED'
        """
        try:
            rows = list(ga_service.search(customer_id=cid, query=query))
            if rows:
                total_cost = sum(round(r.metrics.cost_micros / MICROS, 2) for r in rows)
                total_impr = sum(r.metrics.impressions for r in rows)
                print(f'✅  {acct["name"]} ({cid})')
                print(f'     Campaigns:  {len(rows)}')
                print(f'     Cost (30d): ${total_cost:.2f}')
                print(f'     Impressions:{total_impr}')
                lsa_accounts.append({'id': cid, 'name': acct['name']})
            else:
                print(f'—   {acct["name"]} ({cid})  no LOCAL_SERVICES campaigns')
        except Exception as e:
            print(f'⚠️   {acct["name"]} ({cid})  error: {e}')

    # ── Step 3: check local_services_lead resource ────────────────────────────
    if lsa_accounts:
        print(f'\nChecking leads for {lsa_accounts[0]["name"]}...')
        lead_query = """
            SELECT
              local_services_lead.id,
              local_services_lead.lead_type,
              local_services_lead.lead_status,
              local_services_lead.lead_charged,
              local_services_lead.creation_date_time
            FROM local_services_lead
            LIMIT 5
        """
        try:
            leads = list(ga_service.search(customer_id=lsa_accounts[0]['id'], query=lead_query))
            print(f'  Found {len(leads)} lead(s)')
            for l in leads:
                lead = l.local_services_lead
                print(f'  Lead {lead.id}: {lead.lead_type.name} / {lead.lead_status.name} / charged={lead.lead_charged}')
        except Exception as e:
            print(f'  local_services_lead query failed: {e}')
    else:
        print('\nNo LOCAL_SERVICES campaigns found in any account.')
        print('Possible causes:')
        print('  - Google Guarantee not yet active in any account')
        print('  - Campaigns paused/removed')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'FATAL: {e}', file=sys.stderr)
        sys.exit(1)
