"""
tools/ads_fetch.py
Fetches campaign + keyword performance for a Google Ads customer account.

Args:
  --customer-id  CUSTOMER_ID   Account ID (digits only, no dashes)
  --start        YYYY-MM-DD
  --end          YYYY-MM-DD

Reads ADS_DEVELOPER_TOKEN and ADS_MCC_ID from environment.
Reads OAuth credentials from credentials.json + token.json at project root.

Output (stdout JSON):
{
  "summary":   { impressions, clicks, cost, ctr, avg_cpc, conversions, cost_per_conversion },
  "campaigns": [ { id, name, status, impressions, clicks, cost, ctr, avg_cpc, conversions, cost_per_conversion } ],
  "keywords":  [ { text, match_type, quality_score, impressions, clicks, cost, ctr, avg_cpc, conversions } ],
  "dateRange": { "start": "...", "end": "..." }
}

Install: pip3 install google-ads
"""

import argparse
import json
import os
import re
import sys

_ROOT = os.path.join(os.path.dirname(__file__), '..')
CREDENTIALS_FILE = os.path.join(_ROOT, 'credentials.json')
TOKEN_FILE       = os.path.join(_ROOT, 'token.json')

MICROS = 1_000_000


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


def safe_float(v, divisor=1) -> float:
    try:
        return round(float(v) / divisor, 2)
    except (TypeError, ZeroDivisionError):
        return 0.0


_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_ID_RE   = re.compile(r'^\d+$')

def _validate_inputs(customer_id: str, start: str, end: str) -> None:
    if not _ID_RE.match(customer_id):
        raise ValueError(f'Invalid customer_id: {customer_id!r}')
    if not _DATE_RE.match(start) or not _DATE_RE.match(end):
        raise ValueError(f'Invalid date range: {start!r} – {end!r}')


def fetch_campaigns(ga_service, customer_id: str, start: str, end: str) -> list:
    _validate_inputs(customer_id, start, end)
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.cost_per_conversion
        FROM campaign
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
    """
    rows = []
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        for row in response:
            c = row.campaign
            m = row.metrics
            rows.append({
                'id':                  str(c.id),
                'name':                c.name,
                'status':              c.status.name,
                'impressions':         int(m.impressions),
                'clicks':              int(m.clicks),
                'cost':                safe_float(m.cost_micros, MICROS),
                'ctr':                 safe_float(m.ctr * 100),
                'avg_cpc':             safe_float(m.average_cpc, MICROS),
                'conversions':         safe_float(m.conversions),
                'cost_per_conversion': safe_float(m.cost_per_conversion, MICROS),
            })
    except Exception as e:
        print(f'[ads_fetch] campaigns error: {e}', file=sys.stderr)
    return rows


def fetch_keywords(ga_service, customer_id: str, start: str, end: str) -> list:
    _validate_inputs(customer_id, start, end)
    query = f"""
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.quality_info.quality_score,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions
        FROM keyword_view
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
          AND ad_group_criterion.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
    """
    rows = []
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        for row in response:
            kw = row.ad_group_criterion
            m  = row.metrics
            qs = kw.quality_info.quality_score
            rows.append({
                'text':          kw.keyword.text,
                'match_type':    kw.keyword.match_type.name,
                'quality_score': int(qs) if qs else None,
                'impressions':   int(m.impressions),
                'clicks':        int(m.clicks),
                'cost':          safe_float(m.cost_micros, MICROS),
                'ctr':           safe_float(m.ctr * 100),
                'avg_cpc':       safe_float(m.average_cpc, MICROS),
                'conversions':   safe_float(m.conversions),
            })
    except Exception as e:
        print(f'[ads_fetch] keywords error: {e}', file=sys.stderr)
    return rows


def fetch_ads(ga_service, customer_id: str, start: str, end: str) -> list:
    _validate_inputs(customer_id, start, end)
    query = f"""
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.type,
          ad_group_ad.status,
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          campaign.name,
          ad_group.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.conversions,
          metrics.cost_per_conversion
        FROM ad_group_ad
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
          AND ad_group_ad.status != 'REMOVED'
          AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
          AND metrics.impressions > 0
        ORDER BY metrics.impressions DESC
        LIMIT 20
    """
    rows = []
    try:
        for row in ga_service.search(customer_id=customer_id, query=query):
            ad = row.ad_group_ad.ad
            metrics = row.metrics
            rows.append({
                'id': str(ad.id),
                'type': ad.type_.name,
                'status': row.ad_group_ad.status.name,
                'campaign_name': row.campaign.name,
                'ad_group_name': row.ad_group.name,
                'headlines': [asset.text for asset in ad.responsive_search_ad.headlines],
                'descriptions': [asset.text for asset in ad.responsive_search_ad.descriptions],
                'final_urls': list(ad.final_urls),
                'impressions': int(metrics.impressions),
                'clicks': int(metrics.clicks),
                'cost': safe_float(metrics.cost_micros, MICROS),
                'ctr': safe_float(metrics.ctr * 100),
                'conversions': safe_float(metrics.conversions),
                'cost_per_conversion': safe_float(metrics.cost_per_conversion, MICROS),
            })
    except Exception as e:
        print(f'[ads_fetch] ads error: {e}', file=sys.stderr)
    return rows


def fetch_pmax_ads(ga_service, customer_id: str, start: str, end: str) -> list:
    _validate_inputs(customer_id, start, end)
    group_query = f"""
        SELECT
          asset_group.id,
          asset_group.name,
          asset_group.status,
          asset_group.final_urls,
          asset_group.path1,
          asset_group.path2,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.conversions,
          metrics.cost_per_conversion
        FROM asset_group
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
          AND asset_group.status != 'REMOVED'
          AND campaign.advertising_channel_type = 'PERFORMANCE_MAX'
          AND metrics.impressions > 0
        ORDER BY metrics.impressions DESC
        LIMIT 1
    """
    try:
        groups = list(ga_service.search(customer_id=customer_id, query=group_query))
        if not groups:
            return []
        row = groups[0]
        group = row.asset_group
        asset_query = f"""
            SELECT
              asset_group_asset.field_type,
              asset.name,
              asset.text_asset.text,
              asset.image_asset.full_size.url,
              asset.call_to_action_asset.call_to_action
            FROM asset_group_asset
            WHERE asset_group.id = {int(group.id)}
              AND asset_group_asset.status != 'REMOVED'
        """
        assets = []
        for asset_row in ga_service.search(customer_id=customer_id, query=asset_query):
            asset = asset_row.asset
            assets.append({
                'field_type': asset_row.asset_group_asset.field_type.name,
                'name': asset.name,
                'text': asset.text_asset.text,
                'image_url': asset.image_asset.full_size.url,
                'call_to_action': asset.call_to_action_asset.call_to_action.name,
            })
        metrics = row.metrics
        return [{
            'id': str(group.id),
            'type': 'PERFORMANCE_MAX',
            'status': group.status.name,
            'campaign_name': row.campaign.name,
            'asset_group_name': group.name,
            'final_urls': list(group.final_urls),
            'path1': group.path1,
            'path2': group.path2,
            'assets': assets,
            'impressions': int(metrics.impressions),
            'clicks': int(metrics.clicks),
            'cost': safe_float(metrics.cost_micros, MICROS),
            'ctr': safe_float(metrics.ctr * 100),
            'conversions': safe_float(metrics.conversions),
            'cost_per_conversion': safe_float(metrics.cost_per_conversion, MICROS),
        }]
    except Exception as e:
        print(f'[ads_fetch] pmax ads error: {e}', file=sys.stderr)
        return []


def build_summary(campaigns: list) -> dict:
    impressions  = sum(c['impressions']  for c in campaigns)
    clicks       = sum(c['clicks']       for c in campaigns)
    cost         = round(sum(c['cost']   for c in campaigns), 2)
    conversions  = round(sum(c['conversions'] for c in campaigns), 1)
    ctr          = round(clicks / impressions * 100, 2) if impressions else 0.0
    avg_cpc      = round(cost / clicks, 2)              if clicks      else 0.0
    cpc          = round(cost / conversions, 2)         if conversions else 0.0
    return {
        'impressions':         impressions,
        'clicks':              clicks,
        'cost':                cost,
        'ctr':                 ctr,
        'avg_cpc':             avg_cpc,
        'conversions':         conversions,
        'cost_per_conversion': cpc,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--customer-id', required=True)
    parser.add_argument('--start',       required=True)
    parser.add_argument('--end',         required=True)
    args = parser.parse_args()

    customer_id = args.customer_id.replace('-', '')
    if not re.fullmatch(r'\d+', customer_id):
        print(json.dumps({'error': 'Invalid customer-id'}), file=sys.stderr)
        sys.exit(1)
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.start) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.end):
        print(json.dumps({'error': 'Invalid date format, expected YYYY-MM-DD'}), file=sys.stderr)
        sys.exit(1)

    client     = get_ads_client()
    ga_service = client.get_service('GoogleAdsService')

    campaigns = fetch_campaigns(ga_service, customer_id, args.start, args.end)
    keywords  = fetch_keywords(ga_service,  customer_id, args.start, args.end)
    ads       = fetch_ads(ga_service, customer_id, args.start, args.end)
    pmax_ads  = fetch_pmax_ads(ga_service, customer_id, args.start, args.end)
    summary   = build_summary(campaigns)

    print(json.dumps({
        'summary':   summary,
        'campaigns': campaigns,
        'keywords':  keywords,
        'ads':       ads,
        'pmax_ads':  pmax_ads,
        'dateRange': {'start': args.start, 'end': args.end},
    }))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
