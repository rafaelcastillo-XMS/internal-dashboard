"""
tools/list_properties.py
Lists all GSC sites and GA4 properties the authenticated account can access.

Output (stdout JSON):
{
  "gscSites": [
    { "url": "https://example.com/", "permissionLevel": "siteOwner" },
    ...
  ],
  "ga4Properties": [
    { "id": "123456789", "name": "My Site", "account": "My Account" },
    ...
  ]
}

Usage:
  python3 tools/list_properties.py
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

from auth import get_credentials
from googleapiclient.discovery import build
from google.analytics import admin as ga4_admin


def list_gsc_sites(creds):
    service = build('webmasters', 'v3', credentials=creds)
    resp = service.sites().list().execute()
    sites = resp.get('siteEntry', [])
    return [
        {
            'url':             s['siteUrl'],
            'permissionLevel': s.get('permissionLevel', 'unknown'),
        }
        for s in sites
    ]


def list_ga4_properties(creds):
    client = ga4_admin.AnalyticsAdminServiceClient(credentials=creds)
    properties = []
    for account in client.list_accounts():
        for prop in client.list_properties(
            request={'filter': f'parent:{account.name}'}
        ):
            properties.append({
                'id':      prop.name.split('/')[-1],
                'name':    prop.display_name,
                'account': account.display_name,
            })
    return properties


def main():
    try:
        creds = get_credentials()
        # Fire both API listings concurrently — they are independent
        with ThreadPoolExecutor(max_workers=2) as ex:
            gsc_future = ex.submit(list_gsc_sites, creds)
            ga4_future = ex.submit(list_ga4_properties, creds)
        result = {
            'gscSites':      gsc_future.result(),
            'ga4Properties': ga4_future.result(),
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
