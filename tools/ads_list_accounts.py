"""
tools/ads_list_accounts.py
Lists all sub-accounts accessible from the MCC.

Reads ADS_DEVELOPER_TOKEN and ADS_MCC_ID from environment.
Reads OAuth credentials from credentials.json + token.json at project root.

Output (stdout JSON):
  { "accounts": [ { "id": "...", "name": "...", "currency": "...", "timezone": "...", "status": "..." } ] }

Install: pip3 install google-ads
"""

import json
import os
import sys

_ROOT = os.path.join(os.path.dirname(__file__), '..')
CREDENTIALS_FILE = os.path.join(_ROOT, 'credentials.json')
TOKEN_FILE       = os.path.join(_ROOT, 'token.json')


def get_ads_client():
    from google.ads.googleads.client import GoogleAdsClient

    developer_token = os.environ.get('ADS_DEVELOPER_TOKEN', '')
    mcc_id          = os.environ.get('ADS_MCC_ID', '').replace('-', '')

    if not developer_token:
        raise RuntimeError('ADS_DEVELOPER_TOKEN not set in environment')
    if not mcc_id:
        raise RuntimeError('ADS_MCC_ID not set in environment')

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


def main():
    mcc_id = os.environ.get('ADS_MCC_ID', '').replace('-', '')

    client = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')

    # Query CustomerClient resource from the MCC to get all direct sub-accounts
    query = """
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.time_zone,
          customer_client.status,
          customer_client.level,
          customer_client.manager
        FROM customer_client
        WHERE customer_client.level = 1
          AND customer_client.manager = false
    """

    accounts = []
    try:
        response = ga_service.search(customer_id=mcc_id, query=query)
        for row in response:
            cc = row.customer_client
            cid = cc.client_customer.split('/')[-1]
            accounts.append({
                'id':       cid,
                'name':     cc.descriptive_name or f'Account {cid}',
                'currency': cc.currency_code,
                'timezone': cc.time_zone,
                'status':   cc.status.name,
            })
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

    accounts.sort(key=lambda a: a['name'].lower())
    print(json.dumps({'accounts': accounts}))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
