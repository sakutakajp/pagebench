"""Fixed three-page manual mobile pilot; no raw data or checkpoint persistence."""
import argparse
import json
import os
from psi import validate_row
import psi_transport as transport

URLS = ('https://hirameki.dev/ja/', 'https://hirameki.dev/en/spin-wheel/',
        'https://hirameki.dev/ja/amidakuji/')


def run(execute=False):
    summary = {'status': 'planned', 'target': 3, 'attempted': 0, 'validated': 0,
               'failed': 0, 'pending': 3, 'mean_score': None, 'categories': {}}
    if not execute:
        return summary
    key = os.environ.get('PSI_API_KEY')
    if not key:
        summary.update(status='failed', categories={'SECRET_ABSENT': 1})
        return summary
    scores = []
    for url in URLS:
        summary['attempted'] += 1
        summary['pending'] -= 1
        try:
            row, failure, halted = transport.request(url, key)
            if row is not None and failure is None and halted is False:
                validate_row(row, url)
                scores.append(row[5])
                summary['validated'] += 1
                continue
            enum = failure.get('error_enum') if isinstance(failure, dict) else None
            code = enum if isinstance(enum, str) and enum in transport.FAILURE_ENUMS else 'INVALID_RESULT'
        except Exception:
            code = 'LOCAL_OR_VALIDATION_ERROR'
        summary['failed'] += 1
        summary['categories'][code] = 1
        break  # stop on first failure/quarantine; no retry or anonymous fallback
    summary['status'] = 'complete' if summary['validated'] == 3 else 'failed'
    if summary['validated'] == 3:
        summary['mean_score'] = sum(scores) / 3
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    try:
        result = run(args.execute)
        output = json.dumps(result, allow_nan=False)
        print(output)
        summary_file = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary_file:
            with open(summary_file, 'a') as f:
                f.write('Fixed mobile PSI pilot\n\n```json\n' + output + '\n```\n')
        return 0 if result['status'] in ('planned', 'complete') else 1
    except Exception:
        print('{"status":"failed","reason":"PILOT_FAILED"}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
