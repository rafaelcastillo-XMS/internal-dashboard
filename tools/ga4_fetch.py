"""
tools/ga4_fetch.py
Fetches Google Analytics 4 data for a given property and date range.

Args:
  --property  GA4_PROPERTY_ID   Numeric property ID (e.g. 123456789)
  --start     YYYY-MM-DD        Start date (inclusive)
  --end       YYYY-MM-DD        End date (inclusive)

Output (stdout JSON) matches DashboardData.ga4 shape expected by the dashboard.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

from auth import get_credentials
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
    OrderBy,
)


# ── helpers ────────────────────────────────────────────────────────────────

def date_delta(date_str: str, days: int) -> str:
    d = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=days)
    return d.strftime('%Y-%m-%d')


def period_days(start: str, end: str) -> int:
    return (datetime.strptime(end, '%Y-%m-%d') - datetime.strptime(start, '%Y-%m-%d')).days + 1


def pct_change(current, previous):
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def fmt_seconds(secs: float) -> str:
    secs = int(secs)
    m, s = divmod(secs, 60)
    return f'{m}m {s:02d}s'


def get_metric_value(row, index: int, cast=float):
    try:
        return cast(row.metric_values[index].value)
    except (IndexError, ValueError):
        return 0


# ── main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--property', required=True)
    parser.add_argument('--start',    required=True)
    parser.add_argument('--end',      required=True)
    args = parser.parse_args()

    creds = get_credentials()
    prop  = f'properties/{args.property}'

    days       = period_days(args.start, args.end)
    prev_end   = date_delta(args.start, -1)
    prev_start = date_delta(prev_end, -(days - 1))

    current_range = DateRange(start_date=args.start, end_date=args.end)
    prev_range    = DateRange(start_date=prev_start,  end_date=prev_end)

    # Build requests up-front (pure data structures, no I/O)
    agg_req = RunReportRequest(
        property=prop,
        date_ranges=[current_range, prev_range],
        metrics=[
            Metric(name='sessions'),
            Metric(name='engagedSessions'),
            Metric(name='conversions'),
        ],
    )
    spark_req = RunReportRequest(
        property=prop,
        date_ranges=[DateRange(start_date=date_delta(args.end, -6), end_date=args.end)],
        dimensions=[Dimension(name='date')],
        metrics=[
            Metric(name='sessions'),
            Metric(name='engagedSessions'),
            Metric(name='conversions'),
        ],
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name='date'))],
    )
    pages_req = RunReportRequest(
        property=prop,
        date_ranges=[current_range],
        dimensions=[Dimension(name='pagePath')],
        metrics=[
            Metric(name='engagedSessions'),
            Metric(name='averageSessionDuration'),
            Metric(name='eventCount'),
            Metric(name='engagementRate'),
        ],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name='engagedSessions'), desc=True)],
        limit=10,
    )
    acq_req = RunReportRequest(
        property=prop,
        date_ranges=[current_range],
        dimensions=[Dimension(name='sessionSource'), Dimension(name='sessionMedium')],
        metrics=[
            Metric(name='sessions'),
            Metric(name='conversions'),
        ],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name='sessions'), desc=True)],
        limit=25,
    )

    # ── Fire all four GA4 requests concurrently ─────────────────────────────
    # Each thread gets its own client instance — gRPC channels are not thread-safe
    def run(req):
        return BetaAnalyticsDataClient(credentials=creds).run_report(req)

    with ThreadPoolExecutor(max_workers=4) as ex:
        agg_future   = ex.submit(run, agg_req)
        spark_future = ex.submit(run, spark_req)
        pages_future = ex.submit(run, pages_req)
        acq_future   = ex.submit(run, acq_req)

    agg_resp   = agg_future.result()
    spark_resp = spark_future.result()
    pages_resp = pages_future.result()
    acq_resp   = acq_future.result()

    # ── Parse aggregate response ────────────────────────────────────────────
    # GA4 returns two rows when two date_ranges are supplied (no dimension needed)
    cur_sessions, cur_engaged, cur_conversions = (0, 0, 0)
    prv_sessions, prv_engaged, prv_conversions = (0, 0, 0)

    for i, row in enumerate(agg_resp.rows):
        s = get_metric_value(row, 0, int)
        e = get_metric_value(row, 1, int)
        c = get_metric_value(row, 2, int)
        if i == 0:
            cur_sessions, cur_engaged, cur_conversions = s, e, c
        elif i == 1:
            prv_sessions, prv_engaged, prv_conversions = s, e, c

    cur_conv_rate = round(cur_conversions / cur_sessions * 100, 2) if cur_sessions else 0.0
    prv_conv_rate = round(prv_conversions / prv_sessions * 100, 2) if prv_sessions else 0.0

    engaged_sessions_delta = pct_change(cur_engaged,   prv_engaged)
    conversion_rate_delta  = pct_change(cur_conv_rate, prv_conv_rate)

    # ── Parse sparkline response ─────────────────────────────────────────────
    engaged_sessions_sparkline = []
    conversion_sparkline       = []
    for row in spark_resp.rows:
        sess = get_metric_value(row, 0, int)
        eng  = get_metric_value(row, 1, int)
        conv = get_metric_value(row, 2, int)
        engaged_sessions_sparkline.append(eng)
        conversion_sparkline.append(round(conv / sess * 100, 2) if sess else 0.0)

    acquisition_sources = []
    for row in acq_resp.rows:
        source    = row.dimension_values[0].value
        medium    = row.dimension_values[1].value
        sessions  = get_metric_value(row, 0, int)
        convs     = get_metric_value(row, 1, int)
        conv_rate = round(convs / sessions, 4) if sessions else 0.0
        acquisition_sources.append({
            'source':      source,
            'medium':      medium,
            'sessions':    sessions,
            'conversions': convs,
            'convRate':    conv_rate,
        })

    top_pages = []
    for row in pages_resp.rows:
        page     = row.dimension_values[0].value
        eng_sess = get_metric_value(row, 0, int)
        avg_dur  = get_metric_value(row, 1, float)
        evt_cnt  = get_metric_value(row, 2, int)
        eng_rate = get_metric_value(row, 3, float)

        top_pages.append({
            'page':            page,
            'engagedSessions': eng_sess,
            'avgEngageTime':   round(avg_dur, 1),
            'eventCount':      evt_cnt,
            'engageRate':      round(eng_rate, 4),
            'sparkline':       [],
        })

    # ── Output ─────────────────────────────────────────────────────────────
    result = {
        'engagedSessions':           cur_engaged,
        'conversionRate':            cur_conv_rate,
        'engagedSessionsDelta':      engaged_sessions_delta,
        'conversionRateDelta':       conversion_rate_delta,
        'engagedSessionsSparkline':  engaged_sessions_sparkline,
        'conversionSparkline':       conversion_sparkline,
        'topPages':                  top_pages,
        'acquisitionSources':        acquisition_sources,
    }

    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
