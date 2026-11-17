"""Bounded, durable, opt-in PSI execution. Public configuration only."""
import argparse
import fcntl
import json
import os
import re
from pathlib import Path
from common import manifest, digest, read, write, VERSION
from psi_transport import request, SafeError, validate
from compare import compare


def validate_row(row, url):
    if not isinstance(row,list) or len(row)!=8 or row[:3]!=['psi-api','mobile',url]:
        raise ValueError('INVALID_ROW')
    lr={'requestedUrl':url,'finalUrl':url,'finalDisplayedUrl':url,'mainDocumentUrl':url,
        'fetchTime':row[3],'lighthouseVersion':row[4],'categories':{'performance':{'score':row[6]}},
        'configSettings':json.loads(row[7])}
    if validate({'id':url,'lighthouseResult':lr},url)!=row: raise ValueError('INVALID_ROW')


def run(m, folder, batches=1, execute=False, secret_env="PSI_API_KEY", transport=None, kind='production'):
    if type(batches) is not int or not 1 <= batches <= 10:
        raise ValueError('BATCH_LIMIT')
    urls = [r['url'] for r in m['records']]
    identity = digest({'manifest': m, 'version': VERSION,
                       'source': [digest(Path(__file__).with_name(f).read_text()) for f in
                                  ('psi.py', 'psi_transport.py', 'common.py')]})
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = os.open(folder/'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        target = folder/'run.json'
        if target.is_symlink() or (target.exists() and (target.stat().st_mode & 0o777)!=0o600):
            raise ValueError('UNSAFE_CHECKPOINT')
        s = read(target) if target.exists() else {
            'identity': identity, 'kind': kind, 'plan': {'manifest_hash': m['sha256'], 'urls': urls},
            'entries': {}, 'rows': [], 'failures': [], 'terminal_status': 'planned'}
        if s['identity'] != identity or s['kind'] != kind:
            raise ValueError('RUN_IDENTITY_MISMATCH')
        for row in s['rows']:
            if row[2] not in urls: raise ValueError('INVALID_ROW')
            validate_row(row,row[2])
        if len({r[2] for r in s['rows']})!=len(s['rows']): raise ValueError('DUPLICATE_ROW')
        if not execute:
            write(target, s)
            return s
        if kind == 'production' and transport is not None:
            raise ValueError('SYNTHETIC_PRODUCTION_MIX')
        if kind == 'synthetic' and transport is None:
            raise ValueError('SYNTHETIC_TRANSPORT_REQUIRED')
        for url, status in list(s['entries'].items()):
            if status == 'in_flight':
                s['entries'][url] = 'failure'
                s['failures'].append({'url': url, 'error_enum': 'INTERRUPTED_OUTCOME_UNKNOWN'})
        write(target, s)
        if s['terminal_status'] == 'halted_auth_or_quota':
            return s
        pending = [u for u in urls if u not in s['entries']]
        key = None
        if pending and kind == 'production':
            if not secret_env or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,127}', secret_env):
                raise SafeError('SECRET_ENV_REQUIRED')
            key = os.environ.get(secret_env)
            if not key:
                raise SafeError('SECRET_ABSENT')
        for url in pending[:batches*10]:
            s['entries'][url] = 'in_flight'
            write(target, s)
            row, failure, halt = (transport or request)(url, key)
            if row is not None:
                validate_row(row, url)
                s['entries'][url] = 'success'
                s['rows'].append(row)
            else:
                s['entries'][url] = 'failure'
                s['failures'].append({'url': url, **failure})
            s['terminal_status'] = 'halted_auth_or_quota' if halt else 'partial'
            write(target, s)  # write BEFORE the next request
            if halt:
                break
        s['pending_urls'] = [u for u in urls if u not in s['entries']]
        if s['terminal_status'] != 'halted_auth_or_quota':
            s['terminal_status'] = 'partial' if s['pending_urls'] else 'completed_with_failures' if s['failures'] else 'complete'
        write(target, s)
        return s
    finally:
        os.close(lock)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('run')
    r.add_argument('--manifest', required=True)
    r.add_argument('--run-dir', required=True)
    r.add_argument('--max-batches', type=int, default=1)
    r.add_argument('--execute', action='store_true')
    r.add_argument('--secret-env', choices=['PSI_API_KEY'], default='PSI_API_KEY')
    c = sub.add_parser('compare')
    c.add_argument('before'); c.add_argument('after'); c.add_argument('--out', required=True)
    a = p.parse_args()
    try:
        if a.cmd == 'run':
            s = run(manifest(a.manifest), a.run_dir, a.max_batches, a.execute, a.secret_env)
            print(json.dumps({'status': s['terminal_status'], 'success': len(s['rows']), 'failed': len(s['failures']),
                              'target': len(s['plan']['urls'])}))
        else:
            result = compare(read(a.before), read(a.after)); write(a.out, result)
            print(json.dumps(result))
    except BaseException:
        print('{"status":"failed","reason":"PSI_RUN_FAILED"}')
        raise SystemExit(1)
