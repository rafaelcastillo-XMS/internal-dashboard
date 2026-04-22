"""
scripts/sync_ads.py
Syncs Google Ads accounts + campaign performance to Supabase tables.

Environment variables required:
  ADS_DEVELOPER_TOKEN
  ADS_MCC_ID
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_REFRESH_TOKEN
  SUPABASE_URL
  SUPABASE_SERVICE_KEY

Install: pip install google-ads supabase
Run:     python scripts/sync_ads.py
"""

import json
import os
import sys
from datetime import date, timedelta

from google.ads.googleads.client import GoogleAdsClient
from supabase import create_client

MICROS = 1_000_000
DATE_RANGES = [
    ("last_7",  7),
    ("last_30", 30),
    ("last_90", 90),
]


def get_ads_client():
    mcc_id = os.environ["ADS_MCC_ID"].replace("-", "")
    config = {
        "developer_token":   os.environ["ADS_DEVELOPER_TOKEN"],
        "login_customer_id": mcc_id,
        "client_id":         os.environ["GOOGLE_CLIENT_ID"],
        "client_secret":     os.environ["GOOGLE_CLIENT_SECRET"],
        "refresh_token":     os.environ["GOOGLE_REFRESH_TOKEN"],
        "use_proto_plus":    True,
    }
    return GoogleAdsClient.load_from_dict(config)


def get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def safe_float(v, divisor=1):
    try:
        return round(float(v) / divisor, 2)
    except (TypeError, ZeroDivisionError):
        return 0.0


def date_range(days):
    end = date.today()
    start = end - timedelta(days=days)
    return str(start), str(end)


def fetch_accounts(ga_service, mcc_id):
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
    response = ga_service.search(customer_id=mcc_id, query=query)
    for row in response:
        cc = row.customer_client
        cid = cc.client_customer.split("/")[-1]
        accounts.append({
            "id":       cid,
            "name":     cc.descriptive_name or f"Account {cid}",
            "currency": cc.currency_code,
            "timezone": cc.time_zone,
            "status":   cc.status.name,
        })
    accounts.sort(key=lambda a: a["name"].lower())
    return accounts


def fetch_campaigns(ga_service, customer_id, start, end):
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
            c, m = row.campaign, row.metrics
            rows.append({
                "campaign_id":         str(c.id),
                "campaign_name":       c.name,
                "status":              c.status.name,
                "impressions":         int(m.impressions),
                "clicks":              int(m.clicks),
                "cost":                safe_float(m.cost_micros, MICROS),
                "ctr":                 safe_float(m.ctr * 100),
                "avg_cpc":             safe_float(m.average_cpc, MICROS),
                "conversions":         safe_float(m.conversions),
                "cost_per_conversion": safe_float(m.cost_per_conversion, MICROS),
            })
    except Exception as e:
        print(f"  [warn] campaigns error for {customer_id}: {e}", file=sys.stderr)
    return rows


def fetch_keywords(ga_service, customer_id, start, end):
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
            kw, m = row.ad_group_criterion, row.metrics
            qs = kw.quality_info.quality_score
            rows.append({
                "keyword_text":  kw.keyword.text,
                "match_type":    kw.keyword.match_type.name,
                "quality_score": int(qs) if qs else None,
                "impressions":   int(m.impressions),
                "clicks":        int(m.clicks),
                "cost":          safe_float(m.cost_micros, MICROS),
                "ctr":           safe_float(m.ctr * 100),
                "avg_cpc":       safe_float(m.average_cpc, MICROS),
                "conversions":   safe_float(m.conversions),
            })
    except Exception as e:
        print(f"  [warn] keywords error for {customer_id}: {e}", file=sys.stderr)
    return rows


def main():
    mcc_id = os.environ["ADS_MCC_ID"].replace("-", "")
    client = get_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    sb = get_supabase()

    print("Fetching accounts...")
    accounts = fetch_accounts(ga_service, mcc_id)
    print(f"  Found {len(accounts)} accounts")

    sb.table("sem_accounts").upsert(accounts).execute()
    print("  Saved accounts to Supabase")

    for account in accounts:
        if account["status"] != "ENABLED":
            continue
        cid = account["id"]
        print(f"\nSyncing {account['name']} ({cid})...")

        for range_label, days in DATE_RANGES:
            start, end = date_range(days)
            print(f"  Range: {range_label} ({start} → {end})")

            campaigns = fetch_campaigns(ga_service, cid, start, end)
            keywords = fetch_keywords(ga_service, cid, start, end)

            if campaigns:
                rows = [{"account_id": cid, "date_range": range_label, **c} for c in campaigns]
                sb.table("sem_campaigns").upsert(rows).execute()
                print(f"    Saved {len(campaigns)} campaigns")

            if keywords:
                rows = [{"account_id": cid, "date_range": range_label, **k} for k in keywords]
                sb.table("sem_keywords").upsert(rows).execute()
                print(f"    Saved {len(keywords)} keywords")

    print("\nSync complete.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)
