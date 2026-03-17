"""
tools/psi_fetch.py
Runs a PageSpeed Insights audit for a given URL.

Args:
  --url  URL_TO_AUDIT   Full URL including protocol (e.g. https://example.com/)

Reads PSI_API_KEY from environment.
Falls back to GOOGLE_API_KEY if PSI_API_KEY is not set.

Output (stdout JSON) matches DashboardData.psi shape expected by the dashboard.
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.parse


PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'


def fetch_psi(url: str, api_key: str, strategy: str = 'mobile') -> dict:
    params = urllib.parse.urlencode({
        'url':      url,
        'strategy': strategy,
        'key':      api_key,
    })
    with urllib.request.urlopen(f'{PSI_ENDPOINT}?{params}', timeout=60) as resp:
        return json.loads(resp.read())


def parse_metric(data: dict, key: str):
    # Try URL-level CrUX data first, fall back to origin-level
    for field in ('loadingExperience', 'originLoadingExperience'):
        try:
            value = data[field]['metrics'][key]['percentile']
            if value is not None:
                return value
        except (KeyError, TypeError):
            continue
    return None


def parse_mobile_verdict(data: dict) -> dict:
    try:
        result = data['lighthouseResult']
        score   = result['categories']['performance']['score']
        verdict = 'PASS' if score >= 0.9 else ('PARTIAL' if score >= 0.5 else 'FAIL')
        audits  = result.get('audits', {})
        issues  = [
            v['title']
            for v in audits.values()
            if v.get('score') is not None and v['score'] < 0.9
            and v.get('details', {}).get('type') not in ('opportunity',)
        ][:5]
        return {'verdict': verdict, 'issues': issues}
    except (KeyError, TypeError):
        return {'verdict': None, 'issues': []}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    args = parser.parse_args()

    api_key = os.environ.get('PSI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        print(json.dumps({'error': 'PSI_API_KEY not set in environment'}), file=sys.stderr)
        sys.exit(1)

    data = fetch_psi(args.url, api_key)

    lcp_raw = parse_metric(data, 'LARGEST_CONTENTFUL_PAINT_MS')
    inp_raw = parse_metric(data, 'INTERACTION_TO_NEXT_PAINT')
    cls_raw = parse_metric(data, 'CUMULATIVE_LAYOUT_SHIFT_SCORE')
    fid_raw = parse_metric(data, 'FIRST_INPUT_DELAY_MS')

    result = {
        'metrics': {
            'lcp': round(lcp_raw / 1000, 2) if lcp_raw is not None else None,
            'inp': inp_raw,
            'cls': round(cls_raw / 100, 3)  if cls_raw is not None else None,
            'fid': fid_raw,
        },
        'mobile':     parse_mobile_verdict(data),
        'auditedUrl': args.url,
    }

    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
