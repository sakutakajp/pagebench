"""Bounded static lexical HTML scan. No evaluation, DOM, fetch, source output."""
import sys,json,re
from html.parser import HTMLParser
from urllib.parse import urlsplit
MAX_BODY=262144
KINDS=('SCRIPT_SRC','LINK_PRELOAD_SCRIPT','LINK_MODULEPRELOAD','LINK_PREFETCH_SCRIPT','LINK_PREFETCH_UNTYPED','HEADER_LINK_SCRIPT','HEADER_LINK_UNTYPED_PREFETCH')
POSITIONS=('HEAD','BODY','AFTER_EXPLICIT_BODY_END','OUTSIDE_EXPLICIT_HEAD_BODY','INERT_OR_AMBIGUOUS','HEADER')
DEPS=('GTM','ADSENSE','TURNSTILE','TWITTER','RELATIVE_REFERENCE','OTHER_OR_UNKNOWN')
ORIGINS={'www.googletagmanager.com':'GTM','pagead2.googlesyndication.com':'ADSENSE','challenges.cloudflare.com':'TURNSTILE','platform.twitter.com':'TWITTER'}
def dependency(value):
    if not isinstance(value,str) or not value or len(value)>8192 or re.search(r'[\x00-\x20\x7f\\]',value): return 'OTHER_OR_UNKNOWN'
    try:
        u=urlsplit(value)
        if not u.scheme and not u.netloc and not value.startswith('//'): return 'RELATIVE_REFERENCE'
        if u.scheme=='https' and u.port in (None,443) and not u.username and not u.password and not u.fragment:
            return ORIGINS.get(u.hostname,'OTHER_OR_UNKNOWN')
    except (ValueError,UnicodeError): pass
    return 'OTHER_OR_UNKNOWN'
class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows={};self.tags=0;self.refs=0;self.scripts=0;self.inline=0;self.ambiguous=False;self.limited=False;self.head=False;self.body=False;self.body_ended=False;self.inert=[];self.raw=False;self.seen_head=False;self.seen_body=False
    def add(self,kind,pos,value):
        if self.limited:return
        self.refs+=1
        if self.refs>256:self.limited=True;return
        if not isinstance(value,str) or not value or len(value)>8192:self.ambiguous=True
        key=(kind,pos,dependency(value));self.rows[key]=self.rows.get(key,0)+1
    def handle_starttag(self,tag,attrs):
        if self.limited:return
        self.tags+=1
        if self.tags>2048:self.limited=True;return
        keys=[k for k,_ in attrs]
        if len(keys)!=len(set(keys)) or len(attrs)>64:self.ambiguous=True;return
        a=dict(attrs)
        if tag=='head':
            if self.seen_head or self.body:self.ambiguous=True
            self.seen_head=True;self.head=True
        if tag=='body':
            if self.seen_body or self.head:self.ambiguous=True
            self.seen_body=True;self.body=True
        if tag in ('template','noscript'):self.inert.append(tag)
        pos='INERT_OR_AMBIGUOUS' if self.inert else 'HEAD' if self.head else 'BODY' if self.body else 'AFTER_EXPLICIT_BODY_END' if self.body_ended else 'OUTSIDE_EXPLICIT_HEAD_BODY'
        if tag=='base':self.ambiguous=True # Relative references are never resolved/attributed.
        if tag=='script':
            self.scripts+=1;self.raw=True
            if 'src' in a:self.add('SCRIPT_SRC',pos,a['src'])
            else:self.inline+=1
        if tag=='link':
            rel=(a.get('rel') or '').lower().split()
            if 'modulepreload' in rel:self.add('LINK_MODULEPRELOAD',pos,a.get('href'))
            elif 'preload' in rel and (a.get('as') or '').lower()=='script':self.add('LINK_PRELOAD_SCRIPT',pos,a.get('href'))
            elif 'prefetch' in rel and (a.get('as') or '').lower()=='script':self.add('LINK_PREFETCH_SCRIPT',pos,a.get('href'))
            elif 'prefetch' in rel and not a.get('as'):self.add('LINK_PREFETCH_UNTYPED',pos,a.get('href'))
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag in ('script','head','body','template','noscript'):self.ambiguous=True;self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if tag=='head':self.head=False
        if tag=='body':self.body=False;self.body_ended=True
        if tag=='script':self.raw=False
        if tag in ('template','noscript'):
            if not self.inert or self.inert[-1]!=tag:self.ambiguous=True
            else:self.inert.pop()
    def unknown_decl(self,data):self.ambiguous=True
def scan(html,link):
    s=Scan();s.feed(html);s.close()
    if s.raw or s.inert or s.head or s.body or s.rawdata:s.ambiguous=True
    # Conservative bounded RFC8288 subset. Anything outside it stays ambiguous.
    if link:
        parts=re.split(r',(?=\s*<)',link)
        if len(parts)>64:s.limited=True
        else:
            for part in parts:
                m=re.fullmatch(r'\s*<([^<>\r\n]{1,8192})>((?:\s*;\s*[A-Za-z][A-Za-z0-9_-]*\s*=\s*(?:"[^"\r\n]{0,256}"|[A-Za-z0-9_-]+))*)\s*',part)
                if not m:s.ambiguous=True;continue
                pairs=re.findall(r';\s*([A-Za-z][A-Za-z0-9_-]*)\s*=\s*("[^"\r\n]*"|[A-Za-z0-9_-]+)',m[2]);names=[k.lower() for k,v in pairs]
                if len(names)!=len(set(names)):s.ambiguous=True;continue
                a={k.lower():v.strip('"').lower() for k,v in pairs};rel=a.get('rel','').split()
                if 'modulepreload' in rel or (('preload' in rel or 'prefetch' in rel) and a.get('as')=='script'):s.add('HEADER_LINK_SCRIPT','HEADER',m[1])
                elif 'prefetch' in rel and not a.get('as'):s.add('HEADER_LINK_UNTYPED_PREFETCH','HEADER',m[1])
    rows=[{'kind':k[0],'position':k[1],'dependency':k[2],'count':v} for k,v in sorted(s.rows.items())]
    return {'coverage':'LIMITED' if s.limited else 'AMBIGUOUS' if s.ambiguous else 'STATIC_TOKEN_SCAN_COMPLETE_NOT_BROWSER_DOM','tags':min(s.tags,2048),'script_tags':min(s.scripts,2048),'inline_script_tags':min(s.inline,2048),'references':min(s.refs,256),'rows':rows,'delivery_signature':'NO_INDEPENDENTLY_VERIFIED_SIGNATURE_IMPLEMENTED'}
if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(2*MAX_BODY+1)
        if len(raw)>2*MAX_BODY:raise ValueError()
        v=json.loads(raw);assert set(v)=={'html','link'} and isinstance(v['html'],str) and isinstance(v['link'],str) and len(v['html'].encode('utf-8'))<=MAX_BODY and len(v['link'].encode('utf-8'))<=8192
        print(json.dumps(scan(v['html'],v['link']),separators=(',',':')))
    except Exception: print('{"error":"PARSER"}');sys.exit(1)
