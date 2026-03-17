"""
tools/gsc_fetch.py
Fetches Google Search Console data for a given site and date range.

Args:
  --site  SITE_URL    Exact GSC property URL (e.g. https://example.com/)
  --start YYYY-MM-DD  Start date (inclusive)
  --end   YYYY-MM-DD  End date (inclusive)

Output (stdout JSON) matches DashboardData.gsc shape expected by the dashboard.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

from auth import get_credentials
from googleapiclient.discovery import build


# ── helpers ────────────────────────────────────────────────────────────────

def date_delta(date_str: str, days: int) -> str:
    d = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=days)
    return d.strftime('%Y-%m-%d')


def period_days(start: str, end: str) -> int:
    return (datetime.strptime(end, '%Y-%m-%d') - datetime.strptime(start, '%Y-%m-%d')).days + 1


def query_gsc(service, site: str, start: str, end: str, dimensions: list, row_limit: int = 500):
    body = {
        'startDate':  start,
        'endDate':    end,
        'dimensions': dimensions,
        'rowLimit':   row_limit,
        'dataState':  'final',
    }
    resp = service.searchanalytics().query(siteUrl=site, body=body).execute()
    return resp.get('rows', [])


def weighted_avg_position(rows):
    total_imp = sum(r['impressions'] for r in rows)
    if total_imp == 0:
        return 0.0
    return sum(r['position'] * r['impressions'] for r in rows) / total_imp


def pct_change(current, previous):
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def fmt_seconds(secs: float) -> str:
    secs = int(secs)
    m, s = divmod(secs, 60)
    return f'{m}m {s:02d}s'


# ── main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site',  required=True)
    parser.add_argument('--start', required=True)
    parser.add_argument('--end',   required=True)
    args = parser.parse_args()

    creds = get_credentials()

    days = period_days(args.start, args.end)

    # Prior period (same length, immediately before current)
    prev_end   = date_delta(args.start, -1)
    prev_start = date_delta(prev_end, -(days - 1))

    # ── Fire all three GSC requests concurrently ────────────────────────────
    # Each thread gets its own service instance — httplib2 is not thread-safe
    def fetch_ts_current():
        svc = build('webmasters', 'v3', credentials=creds)
        return query_gsc(svc, args.site, args.start, args.end, ['date'])

    def fetch_ts_prev():
        svc = build('webmasters', 'v3', credentials=creds)
        return query_gsc(svc, args.site, prev_start, prev_end, ['date'])

    def fetch_queries():
        svc = build('webmasters', 'v3', credentials=creds)
        return query_gsc(svc, args.site, args.start, args.end, ['query'], row_limit=50)

    with ThreadPoolExecutor(max_workers=3) as ex:
        ts_future      = ex.submit(fetch_ts_current)
        ts_prev_future = ex.submit(fetch_ts_prev)
        q_future       = ex.submit(fetch_queries)

    ts_rows      = ts_future.result()
    ts_rows_prev = ts_prev_future.result()
    q_rows       = q_future.result()

    # Sort by date ascending
    ts_rows.sort(key=lambda r: r['keys'][0])
    ts_rows_prev.sort(key=lambda r: r['keys'][0])

    date_labels        = [r['keys'][0] for r in ts_rows]
    clicks_ts          = [int(r['clicks'])      for r in ts_rows]
    impressions_ts     = [int(r['impressions']) for r in ts_rows]

    total_clicks       = sum(clicks_ts)
    total_impressions  = sum(impressions_ts)
    avg_position       = weighted_avg_position(ts_rows)
    avg_ctr            = total_clicks / total_impressions if total_impressions > 0 else 0.0

    prev_clicks        = sum(int(r['clicks'])      for r in ts_rows_prev)
    prev_impressions   = sum(int(r['impressions']) for r in ts_rows_prev)
    prev_position      = weighted_avg_position(ts_rows_prev)
    prev_ctr           = prev_clicks / prev_impressions if prev_impressions > 0 else 0.0

    clicks_delta   = pct_change(total_clicks,  prev_clicks)
    position_delta = pct_change(avg_position,  prev_position)
    ctr_delta      = pct_change(avg_ctr,       prev_ctr)

    # Sparkline = last 7 days of the current period
    clicks_sparkline      = clicks_ts[-7:]
    impressions_sparkline = impressions_ts[-7:]

    q_rows.sort(key=lambda r: r['clicks'], reverse=True)

    queries = [
        {
            'query':       r['keys'][0],
            'clicks':      int(r['clicks']),
            'impressions': int(r['impressions']),
            'ctr':         round(r['ctr'], 4),
            'position':    round(r['position'], 1),
        }
        for r in q_rows
    ]

    # ── Output ─────────────────────────────────────────────────────────────
    result = {
        'totalClicks':           total_clicks,
        'totalImpressions':      total_impressions,
        'avgCTR':                round(avg_ctr, 6),
        'avgPosition':           round(avg_position, 1),
        'clicksDelta':           clicks_delta,
        'ctrDelta':              ctr_delta,
        'positionDelta':         position_delta,
        'clicksSparkline':       clicks_sparkline,
        'impressionsSparkline':  impressions_sparkline,
        'clicksTimeSeries':      clicks_ts,
        'impressionsTimeSeries': impressions_ts,
        'dateLabels':            date_labels,
        'queries':               queries,
    }

    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
