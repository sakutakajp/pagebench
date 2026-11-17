"""Manual Actions demo: public sitemap -> at most three URLs, never PSI execution."""
import json
import os
import signal
import tempfile
from pathlib import Path
from common import digest, manifest, write
from sitemap import generate
from psi import run
from diagnostics import DiagnosticError


def plan(start, folder, loader=None):
    full = generate(start) if loader is None else generate(start, loader)
    selected = dict(full)
    selected.pop('sha256')
    selected['source_manifest_hash'] = full['sha256']
    selected['records'] = full['records'][:3]
    if not selected['records']:
        raise ValueError('EMPTY_SITEMAP')
    selected['sha256'] = digest(selected)
    target = Path(folder) / 'selected.json'
    write(target, selected)
    # max-batches is NOT a URL limit. Pin the input to <=3 before dry-run.
    state = run(manifest(target), Path(folder) / 'plan', batches=1, execute=False)
    assert len(state['plan']['urls']) <= 3 and not state['rows']
    return {'status': state['terminal_status'], 'sitemap_count': len(full['records']),
            'planned_count': len(selected['records']), 'google_psi_calls': 0,
            'source_manifest_hash': full['sha256'], 'selected_manifest_hash': selected['sha256']}


if __name__ == '__main__':
    try:
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError()))
        signal.alarm(120)
        with tempfile.TemporaryDirectory(prefix='pagebench-plan-') as folder:
            result = plan(os.environ.get('SITEMAP_URL'), folder)
        signal.alarm(0)
        print(json.dumps(result))
        summary = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary, 'a') as f:
                f.write('Pagebench dry-run\n\n```json\n' + json.dumps(result) + '\n```\n')
    except DiagnosticError as exc:
        print(json.dumps(exc.public()))
        raise SystemExit(1)
    except Exception:
        print('{"status":"failed","stage":"plan","reason":"PLAN_FAILED"}')
        raise SystemExit(1)
