"""Finite independent lexical counters; no browser, evaluation, fetch or source output."""
import sys,json,re
from html.parser import HTMLParser
from urllib.parse import urlsplit
MAX_BODY=262144
TOKEN_LIMIT=90000 # Any source tag token consumes at least3 UTF-8 bytes: floor(256KiB/3)<90000.
HEADER_LIMIT=8193 # An8KiB string can split into at most8193 non-overlapping parts.
POSITIONS=('HEAD','BODY','AFTER_EXPLICIT_BODY_END','OUTSIDE_EXPLICIT_HEAD_BODY','INERT_OR_AMBIGUOUS','HEADER')
DEPS=('GTM','ADSENSE','TURNSTILE','TWITTER','OTHER_OR_UNKNOWN')
FORMS=('RELATIVE','PROTOCOL_RELATIVE','ABSOLUTE_HTTPS','ABSOLUTE_OTHER','INVALID')
SPECS={
 'SCRIPT_SRC':(1024,('SCRIPT_SRC',)),
 'BODY_HINTS':(256,('LINK_PRELOAD_SCRIPT','LINK_MODULEPRELOAD','LINK_PREFETCH_SCRIPT','LINK_PREFETCH_UNTYPED')),
 'HTTP_SCRIPT_HINTS':(128,('HEADER_LINK_SCRIPT',)),
 'HTTP_UNTYPED_PREFETCH':(128,('HEADER_LINK_UNTYPED_PREFETCH',)),
}
ORIGINS={'www.googletagmanager.com':'GTM','pagead2.googlesyndication.com':'ADSENSE','challenges.cloudflare.com':'TURNSTILE','platform.twitter.com':'TWITTER'}
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
def classify(value):
    if not isinstance(value,str) or not value or len(value)>8192 or re.search(r'[\x00-\x20\x7f\\]',value):return 'INVALID','OTHER_OR_UNKNOWN'
    try:
        u=urlsplit(value)
        if value.startswith('//'):return 'PROTOCOL_RELATIVE','OTHER_OR_UNKNOWN'
        if not u.scheme and not u.netloc:return 'RELATIVE','OTHER_OR_UNKNOWN'
        form='ABSOLUTE_HTTPS' if u.scheme=='https' else 'ABSOLUTE_OTHER'
        if u.scheme=='https' and u.hostname and u.port in (None,443) and '@' not in u.netloc and not u.username and not u.password and not u.fragment:return form,ORIGINS.get(u.hostname,'OTHER_OR_UNKNOWN')
        return form,'OTHER_OR_UNKNOWN'
    except (ValueError,UnicodeError):return 'INVALID','OTHER_OR_UNKNOWN'
class Channel:
    def __init__(self,limit,kinds):
        self.limit=limit;self.count=0;self.saturated=False;self.ambiguous=False;self.token_limited=False
        self.kinds=dict.fromkeys(kinds,0);self.positions=dict.fromkeys(POSITIONS,0);self.dependencies=dict.fromkeys(DEPS,0);self.forms=dict.fromkeys(FORMS,0)
    def add(self,kind,pos,value):
        if self.count>=self.limit:self.saturated=True
        self.count=min(self.limit,self.count+1)
        form,dep=classify(value)
        if form=='INVALID':self.ambiguous=True
        for bins,key in [(self.kinds,kind),(self.positions,pos),(self.dependencies,dep),(self.forms,form)]:bins[key]=min(self.limit,bins[key]+1)
    def fixed(self):
        return {'parse_coverage':'TOKEN_LIMITED' if self.token_limited else 'AMBIGUOUS' if self.ambiguous else 'COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM','count_coverage':'SATURATED_LOWER_BOUNDS' if self.saturated else 'EXACT','count_limit':self.limit,'observed_count':self.count,'kinds':self.kinds,'positions':self.positions,'dependencies':self.dependencies,'forms':self.forms}
class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.channels={name:Channel(*spec) for name,spec in SPECS.items()};self.tokens=0;self.token_limited=False;self.body_ambiguous=False
        self.head=False;self.body=False;self.body_ended=False;self.seen_head=False;self.seen_body=False;self.inert=[];self.context_lost=False;self.raw=None;self.plain=False
        self.base=0;self.base_invalid=False;self.raw_elements=0;self.scripts=0;self.inline=0;self.stack=[]
    def ambiguous(self,*names):
        if not names:self.body_ambiguous=True;names=('SCRIPT_SRC','BODY_HINTS')
        for name in names:self.channels[name].ambiguous=True
    def token(self):
        if self.tokens>=TOKEN_LIMIT:
            self.token_limited=True
            for name in ('SCRIPT_SRC','BODY_HINTS'):self.channels[name].token_limited=True
            return False
        self.tokens+=1;return True
    def handle_starttag(self,tag,attrs):
        if self.token():self.start(tag,attrs)
    def handle_startendtag(self,tag,attrs):
        if not self.token():return
        self.start(tag,attrs)
        if tag not in VOID:
            self.ambiguous();self.end(tag);self.clear_cdata_mode()
        # A self-closing source token counts once, not an artificial start+end pair.
    def start(self,tag,attrs):
        if self.plain:return
        if not self.context_lost and tag not in VOID:
            if len(self.stack)>=64 or len(tag)>128:self.context_lost=True;self.ambiguous()
            else:self.stack.append(tag)
        if tag in ('script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext'):
            self.raw=tag;self.raw_elements=min(32768,self.raw_elements+1);self.set_cdata_mode(tag)
            if tag=='plaintext':self.plain=True;self.ambiguous()
        keys=[k for k,_ in attrs];invalid=len(keys)!=len(set(keys)) or len(attrs)>64
        if tag=='head':
            if self.seen_head or self.body:self.ambiguous()
            self.seen_head=True;self.head=True
        if tag=='body':
            if self.seen_body or self.head:self.ambiguous()
            self.seen_body=True;self.body=True
        if tag in ('template','noscript'):
            if len(self.inert)>=64:self.context_lost=True;self.ambiguous()
            else:self.inert.append(tag)
        if tag in ('svg','math'):self.ambiguous()
        pos='INERT_OR_AMBIGUOUS' if self.inert or self.context_lost else 'HEAD' if self.head else 'BODY' if self.body else 'AFTER_EXPLICIT_BODY_END' if self.body_ended else 'OUTSIDE_EXPLICIT_HEAD_BODY'
        a=dict(attrs)
        if tag=='base':
            self.base=min(2,self.base+1);self.base_invalid|=invalid or not a.get('href')
        if tag=='script':self.scripts=min(32768,self.scripts+1)
        if invalid:
            self.ambiguous('SCRIPT_SRC' if tag=='script' else 'BODY_HINTS') if tag in ('script','link') else self.ambiguous()
            return
        if tag=='script':
            if 'src' in a:self.channels['SCRIPT_SRC'].add('SCRIPT_SRC',pos,a['src'])
            else:self.inline=min(32768,self.inline+1)
        if tag=='link':
            rel=(a.get('rel') or '').lower().split();kind=None
            if 'modulepreload' in rel:kind='LINK_MODULEPRELOAD'
            elif 'preload' in rel and (a.get('as') or '').lower()=='script':kind='LINK_PRELOAD_SCRIPT'
            elif 'prefetch' in rel and (a.get('as') or '').lower()=='script':kind='LINK_PREFETCH_SCRIPT'
            elif 'prefetch' in rel and not a.get('as'):kind='LINK_PREFETCH_UNTYPED'
            if kind:self.channels['BODY_HINTS'].add(kind,pos,a.get('href'))
    def handle_endtag(self,tag):
        if self.token():self.end(tag)
    def end(self,tag):
        if self.plain:return
        if not self.context_lost:
            if not self.stack or self.stack[-1]!=tag:self.context_lost=True;self.ambiguous()
            else:self.stack.pop()
        if tag==self.raw:self.raw=None
        if tag=='head':
            if not self.head:self.ambiguous()
            self.head=False
        if tag=='body':
            if not self.body:self.ambiguous()
            self.body=False;self.body_ended=True
        if tag in ('template','noscript'):
            if not self.inert or self.inert[-1]!=tag:self.context_lost=True;self.ambiguous()
            else:self.inert.pop()
    def unknown_decl(self,data):self.ambiguous()
    # Input is supplied once, after the bounded complete response is received.
    # Python's close() can split an incomplete construct into harmless-looking
    # data callbacks; preserve its earlier incomplete-token verdict instead.
    def parse_comment(self,i,report=1):
        result=super().parse_comment(i,report)
        if result<0:self.ambiguous()
        return result
    def parse_starttag(self,i):
        result=super().parse_starttag(i)
        if result<0:self.ambiguous()
        return result
    def parse_endtag(self,i):
        result=super().parse_endtag(i)
        if result<0:self.ambiguous()
        return result
    def handle_data(self,data):
        if not self.raw and not self.plain and re.search(r'<!--|<[/!]?[A-Za-z]',data):self.ambiguous()
def scan(html,link):
    s=Scan();s.feed(html);s.close()
    if s.raw or s.inert or s.head or s.body or s.rawdata or s.stack:s.ambiguous()
    header_parts=0;header_ambiguous=False
    if link:
        parts=re.split(r',(?=\s*<)',link)
        if len(parts)>HEADER_LIMIT:raise ValueError()
        for part in parts:
            header_parts+=1
            m=re.fullmatch(r'\s*<([^<>\r\n]{1,8192})>((?:\s*;\s*[A-Za-z][A-Za-z0-9_-]*\s*=\s*(?:"[^"\r\n]{0,256}"|[A-Za-z0-9_-]+))*)\s*',part)
            if not m:header_ambiguous=True;continue
            pairs=re.findall(r';\s*([A-Za-z][A-Za-z0-9_-]*)\s*=\s*("[^"\r\n]*"|[A-Za-z0-9_-]+)',m[2]);names=[k.lower() for k,v in pairs]
            if len(names)!=len(set(names)):header_ambiguous=True;continue
            a={k.lower():v.strip('"').lower() for k,v in pairs};rel=a.get('rel','').split()
            if 'modulepreload' in rel or (('preload' in rel or 'prefetch' in rel) and a.get('as')=='script'):s.channels['HTTP_SCRIPT_HINTS'].add('HEADER_LINK_SCRIPT','HEADER',m[1])
            elif 'prefetch' in rel and not a.get('as'):s.channels['HTTP_UNTYPED_PREFETCH'].add('HEADER_LINK_UNTYPED_PREFETCH','HEADER',m[1])
    if header_ambiguous:
        s.channels['HTTP_SCRIPT_HINTS'].ambiguous=True;s.channels['HTTP_UNTYPED_PREFETCH'].ambiguous=True
    return {'body_token_coverage':'TOKEN_LIMITED' if s.token_limited else 'AMBIGUOUS' if s.body_ambiguous else 'COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM','tag_tokens':s.tokens,'header_parts':header_parts,'base':'MULTIPLE_OR_INVALID' if s.base>1 or s.base_invalid else 'PRESENT_NOT_RESOLVED' if s.base else 'UNKNOWN' if s.token_limited or s.body_ambiguous else 'ABSENT','script_tags':s.scripts,'inline_script_tags':s.inline,'raw_text_elements_ignored':s.raw_elements,'dynamic_sources':'NOT_EVALUATED','channels':{name:c.fixed() for name,c in s.channels.items()},'delivery_signature':'NO_INDEPENDENTLY_VERIFIED_SIGNATURE_IMPLEMENTED'}
if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(2*MAX_BODY+1)
        if len(raw)>2*MAX_BODY:raise ValueError()
        v=json.loads(raw);assert set(v)=={'html','link'} and isinstance(v['html'],str) and isinstance(v['link'],str) and len(v['html'].encode('utf-8'))<=MAX_BODY and len(v['link'].encode('utf-8'))<=8192
        print(json.dumps(scan(v['html'],v['link']),separators=(',',':')))
    except Exception:print('{"error":"PARSER"}');sys.exit(1)
