"""Explicit bounded HTTPS sitemap import; no network during measurement planning."""
import argparse
import ipaddress
import os
import socket
import signal
import ssl
import time
import urllib.request
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from common import canonical, origin, digest, write
from psi_transport import NoRedirect
MAX_BYTES = 4 * 1024 * 1024


def safe_url(value, site):
    u = urlsplit(value)
    if not isinstance(value, str) or len(value) > 2048 or u.scheme != 'https' or u.netloc != urlsplit(site).netloc or u.query or u.fragment or '?' in value or '#' in value:
        raise ValueError('SITEMAP_URL')
    # The sitemap XML path may end in .xml instead of a directory slash.
    canonical(value + ('/' if not u.path.endswith('/') else ''), site)
    return value


def fetch(value):
    host = urlsplit(value).hostname
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError('NONPUBLIC_ADDRESS')
    # Public DNS is checked; callers must use trusted public hosts (not hostile DNS).
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(value, timeout=15) as response:
        if response.status != 200 or response.geturl() != value:
            raise ValueError('SITEMAP_HTTP')
        data = response.read(MAX_BYTES+1)
    if len(data) > MAX_BYTES:
        raise ValueError('SITEMAP_TOO_LARGE')
    return data


def generate(start, loader=fetch):
    if not start:
        raise ValueError('SITEMAP_URL_UNSET')
    parsed = urlsplit(start)
    site = origin(f'{parsed.scheme}://{parsed.netloc}')
    safe_url(start, site)
    queue = [start]; seen = set(); urls = set(); total = 0; deadline = time.monotonic()+120
    ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
    while queue:
        url = queue.pop(0)
        if url in seen: continue
        if len(seen) >= 32 or time.monotonic() > deadline: raise ValueError('SITEMAP_LIMIT')
        seen.add(url); raw = loader(url); total += len(raw)
        if len(raw) > MAX_BYTES or total > 16*MAX_BYTES: raise ValueError('SITEMAP_SIZE')
        # UTF-8 only, reject DTD/entities before parsing, including UTF-16 encodings.
        text = raw.decode('utf-8-sig', errors='strict')
        if '<!' in text or '\x00' in text: raise ValueError('UNSAFE_XML')
        root = ET.fromstring(text)
        if root.tag not in (ns+'urlset', ns+'sitemapindex'): raise ValueError('XML_ROOT')
        child = ns+('url' if root.tag == ns+'urlset' else 'sitemap')
        for element in root:
            if element.tag != child: raise ValueError('XML_CHILD')
            locs = element.findall(ns+'loc')
            if len(locs) != 1 or len(locs[0]) or not locs[0].text: raise ValueError('XML_LOC')
            value = locs[0].text.strip()
            if root.tag == ns+'sitemapindex':
                queue.append(safe_url(value, site))
                if len(queue)>1000: raise ValueError('SITEMAP_LIMIT')
            else:
                urls.add(canonical(value, site))
                if len(urls)>100000: raise ValueError('URL_LIMIT')
    m = {'schema':1, 'tool_version':'1.0.0', 'origin':site,
         'source':{'sitemap_url':start,'documents':sorted(seen)},
         'records':[{'url':u} for u in sorted(urls)]}
    m['sha256']=digest(m)
    return m


if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('--out',required=True); a=p.parse_args()
    try:
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError()))
        signal.alarm(120)
        m=generate(os.environ.get('SITEMAP_URL')); signal.alarm(0); write(a.out,m)
        print({'count':len(m['records']),'sha256':m['sha256']})
    except Exception:
        print('{"status":"failed","reason":"SITEMAP_IMPORT_FAILED"}')
        raise SystemExit(1)
