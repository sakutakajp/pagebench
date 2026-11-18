"""Staging-only two-glyph mobile PSI pilot; no raw response persistence."""
import argparse
import json
import os
from pathlib import Path
from xml.etree import ElementTree as ET
from common import canonical, digest, read, write
from sitemap import generate, fetch
import socket, ipaddress, ssl, urllib.request
from urllib.parse import urlsplit
from psi_transport import NoRedirect
from psi import validate_row
from psi_transport import request, FAILURE_ENUMS
SITE = 'https://staging.hirameki.dev'
START = SITE + '/sitemap.xml'
URLS = (SITE + '/ja/font/serif/list/%E3%81%82/', SITE + '/ja/font/cursive/list/A/')
IDS = ('serif-a-ja', 'cursive-A')
NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


def public_fetch(url):
    if url == START:
        return fetch(url)
    if url not in URLS:
        raise ValueError('PREFLIGHT_SCOPE')
    addresses = socket.getaddrinfo(urlsplit(url).hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError('NONPUBLIC_ADDRESS')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(url, timeout=15) as r:
        if r.status != 200 or r.geturl() != url or r.headers.get_content_type() != 'text/html':
            raise ValueError('PREFLIGHT_HTTP')
        data = r.read(4194305)
    if len(data) > 4194304:
        raise ValueError('PREFLIGHT_SIZE')
    return data


def prepare(start, loader=public_fetch):
    if start != START:
        raise ValueError('STAGING_CONFIG_REQUIRED')
    def strict(url):
        if url != START:
            raise ValueError('SITEMAP_SCOPE')
        raw = loader(url)
        text = raw.decode('utf-8-sig')
        if len(raw) > 4194304 or '<!' in text or '\x00' in text:
            raise ValueError('SITEMAP_XML')
        root = ET.fromstring(text)
        if root.tag != NS+'urlset' or any(not e.tag.startswith(NS) for e in root.iter()):
            raise ValueError('SITEMAP_NAMESPACE')
        locs = [e.find(NS+'loc').text for e in root]
        if len(locs) != len(set(locs)) or any(canonical(u, SITE) != u for u in locs):
            raise ValueError('SITEMAP_CANONICAL')
        return raw
    m = generate(start, strict)
    if not set(URLS) <= {r['url'] for r in m['records']}:
        raise ValueError('TARGET_ABSENT')
    # No-secret direct HTML preflight: stop before Google can follow a redirect.
    for url in URLS:
        body = loader(url)
        if len(body) > 4194304 or not body.lstrip().lower().startswith((b'<!doctype html', b'<html')):
            raise ValueError('PREFLIGHT_HTML')
    p = {'schema': 1, 'origin': SITE, 'urls': list(URLS),
         'manifest_hash': m['sha256'], 'sitemap_count': len(m['records'])}
    p['sha256'] = digest(p)
    return p


def checked(p):
    plain = dict(p)
    h = plain.pop('sha256')
    if digest(plain) != h or p['urls'] != list(URLS) or p['origin'] != SITE or p['schema'] != 1:
        raise ValueError('PLAN_MISMATCH')
    return p


def execute(p, checkpoint, transport=request):
    checked(p)
    checkpoint = Path(checkpoint)
    checkpoint.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Exclusive per-run lock: an uncertain process must never cause a second request.
    lock = checkpoint.with_suffix('.lock')
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        s = read(checkpoint) if checkpoint.exists() else {
            'plan_hash': p['sha256'], 'status': 'planned', 'results': []}
        if s['plan_hash'] != p['sha256']:
            raise ValueError('CHECKPOINT_MISMATCH')
        if s['status'] in ('complete', 'failed', 'in_flight'):
            return s
        key = os.environ.get('PSI_API_KEY')
        if not key:
            raise ValueError('SECRET_ABSENT')
        for i, url in enumerate(URLS):
            if i < len(s['results']):
                continue
            s['status'] = 'in_flight'
            write(checkpoint, s)
            row, failure, halt = transport(url, key)
            if row is not None and failure is None and halt is False:
                validate_row(row, url)
                s['results'].append({'id': IDS[i], 'status': 'success', 'score': row[5], 'fetched_at': row[3]})
                s['status'] = 'partial'
                write(checkpoint, s)
            else:
                enum = failure.get('error_enum') if isinstance(failure, dict) else None
                code = enum if enum in FAILURE_ENUMS else 'INVALID_RESULT'
                s['results'].append({'id': IDS[i], 'status': 'failed', 'reason': code})
                s['status'] = 'failed'
                write(checkpoint, s)
                return s
        s['status'] = 'complete'
        write(checkpoint, s)
        return s
    finally:
        lock.unlink()


def emit(summary):
    output = json.dumps(summary, allow_nan=False)
    print(output)
    target = os.environ.get('GITHUB_STEP_SUMMARY')
    if target:
        with open(target, 'a') as f:
            f.write('Staging glyph pilot\n\n```json\n'+output+'\n```\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'execute'])
    parser.add_argument('--plan', required=True)
    parser.add_argument('--checkpoint')
    a = parser.parse_args()
    try:
        if a.command == 'prepare':
            p = prepare(os.environ.get('SITEMAP_URL'))
            write(a.plan, p)
            emit({'status': 'planned', 'sitemap_count': p['sitemap_count'], 'target': 2,
                  'manifest_hash': p['manifest_hash'], 'google_psi_calls': 0})
            return 0
        p = checked(read(a.plan))
        if not a.checkpoint:
            raise ValueError('CHECKPOINT_REQUIRED')
        s = execute(p, a.checkpoint)
        emit({'status': s['status'], 'manifest_hash': p['manifest_hash'], 'results': s['results']})
        return 0 if s['status'] == 'complete' else 1
    except Exception:
        emit({'status': 'failed', 'reason': 'STAGING_PILOT_STOPPED'})
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
