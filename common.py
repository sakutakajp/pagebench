"""Stable inventory and run identity. Standard library only."""
import hashlib,json,os,re,tempfile,unicodedata,ipaddress
from pathlib import Path
from urllib.parse import urlsplit,unquote,quote
VERSION='1.0.0'
def origin(value):
    u=urlsplit(value)
    if u.scheme!='https' or not u.hostname or u.netloc!=u.hostname or u.path or u.query or u.fragment or any(c.isspace() for c in value):
        raise ValueError('INVALID_PUBLIC_ORIGIN')
    if not re.fullmatch(r'[a-z0-9]+(?:[.-][a-z0-9]+)*',u.hostname): raise ValueError('INVALID_HOST')
    try: ipaddress.ip_address(u.hostname)
    except ValueError: pass
    else: raise ValueError('IP_ORIGIN_UNSUPPORTED')
    if '.' not in u.hostname or u.hostname.endswith(('.localhost','.local','.internal')): raise ValueError('NONPUBLIC_ORIGIN')
    return value
def canonical(value, site):
    origin(site)
    if not isinstance(value,str) or len(value)>2048 or any(unicodedata.category(c).startswith('C') for c in value): raise ValueError('INVALID_URL')
    u=urlsplit(value)
    if u.scheme!='https' or u.netloc!=urlsplit(site).netloc or u.query or u.fragment or '?' in value or '#' in value: raise ValueError('ORIGIN_OR_QUERY')
    p=u.path
    if not p.startswith('/') or '//' in p: raise ValueError('PATH_SHAPE')
    if re.search(r'%(?![0-9A-Fa-f]{2})',p): raise ValueError('BAD_ESCAPE')
    decoded=unquote(p,encoding='utf-8',errors='strict')
    # Encoded delimiters, percent/double encoding, dot segments, controls fail closed.
    if len(decoded.split('/'))!=len(p.split('/')) or any(x in ('.','..') for x in decoded.split('/')): raise ValueError('PATH_CONFUSION')
    if any(c.isspace() for c in decoded) or any(c in decoded for c in '%\\?#') or any(unicodedata.category(c).startswith('C') for c in decoded): raise ValueError('UNSAFE_CHARACTER')
    if unicodedata.normalize('NFC',decoded)!=decoded: raise ValueError('NON_NFC')
    normalized=site+quote(decoded,safe='/-._~')
    # Accept literal Unicode or canonical upper-case escapes; reject escaped ASCII,
    # lower-case percent encodings and mixtures that obscure identity.
    if '%' in p and value!=normalized: raise ValueError('NONCANONICAL_ENCODING')
    return normalized

def digest(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
def read(path): return json.loads(Path(path).read_text())
def write(path,value):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.pagebench-')
    try:
        with os.fdopen(fd,'w') as f:
            json.dump(value,f,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False); f.flush(); os.fsync(f.fileno())
        os.replace(tmp,path)
        directory_fd=os.open(path.parent,os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(directory_fd)
        finally: os.close(directory_fd)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
def manifest(path):
    d=read(path); h=d.pop('sha256')
    if digest(d)!=h or d['schema']!=1 or len(set(r['url'] for r in d['records']))!=len(d['records']): raise ValueError('MANIFEST_MISMATCH')
    if any(canonical(r['url'],d['origin'])!=r['url'] for r in d['records']): raise ValueError('NONCANONICAL_MANIFEST')
    d['sha256']=h; return d

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser(description='Pin an ordered URL list; never discover routes over network')
    p.add_argument('--origin',required=True);p.add_argument('--urls',required=True);p.add_argument('--out',required=True)
    a=p.parse_args()
    urls=[canonical(u,a.origin) for u in read(a.urls)]
    if len(set(urls))!=len(urls): raise ValueError('DUPLICATE_URL')
    m={'schema':1,'tool_version':VERSION,'origin':origin(a.origin),'records':[{'url':u} for u in urls]}
    m['sha256']=digest(m);write(a.out,m)
