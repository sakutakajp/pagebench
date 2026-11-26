"""Unchanged parent lexical scan plus bounded private in-memory observer pipe.
Only fixed counters go to stdout. Decoded src travels solely on private fd3;
the Node parent applies the same standard URL implementation as the real guard.
"""
import sys,json,re,os,runpy
from pathlib import Path
MAX_BODY=262144
MAX_PRIVATE=32768
MAX_MESSAGES=256
CAP=1024
POSITIONS=('HEAD','BODY','AFTER_EXPLICIT_BODY_END','OUTSIDE_EXPLICIT_HEAD_BODY','UNKNOWN_OR_AMBIGUOUS')
def main():
    raw=sys.stdin.buffer.read(2*MAX_BODY+1)
    if len(raw)>2*MAX_BODY:raise ValueError()
    v=json.loads(raw);assert set(v)=={'html','link'} and isinstance(v['html'],str) and isinstance(v['link'],str) and len(v['html'].encode('utf-8'))<=MAX_BODY and len(v['link'].encode('utf-8'))<=8192
    parent=runpy.run_path(str(Path(__file__).resolve().parent.parent/'passive-html-channels'/'parser.py'))
    meta={'sent_count':0,'sent_bytes':0,'byte_limited':False,'message_limited':False,'dropped':0,'dropped_saturated':False,'unresolved':dict.fromkeys(POSITIONS,0),'unresolved_saturated':False,'excluded':{'RELATIVE_UNRESOLVED':0,'PROTOCOL_RELATIVE_UNRESOLVED':0,'NON_HTTPS':0},'excluded_saturated':False,'unclassifiable_attributes':0,'unclassifiable_saturated':False}
    def increment(container,key,flag):
        if container[key]>=CAP:meta[flag]=True
        container[key]=min(CAP,container[key]+1)
    with os.fdopen(3,'wb',buffering=0) as private:
        class Observed(parent['Scan']):
            def start(self,tag,attrs):
                was_plain=self.plain
                super().start(tag,attrs)
                if was_plain or tag!='script':return
                keys=[k for k,_ in attrs]
                if len(keys)!=len(set(keys)) or len(attrs)>64:
                    increment(meta,'unclassifiable_attributes','unclassifiable_saturated');return
                a=dict(attrs)
                if 'src' not in a:return
                value=a['src']
                pos='UNKNOWN_OR_AMBIGUOUS' if self.inert or self.context_lost or self.body_ambiguous else 'HEAD' if self.head else 'BODY' if self.body else 'AFTER_EXPLICIT_BODY_END' if self.body_ended else 'OUTSIDE_EXPLICIT_HEAD_BODY'
                if not isinstance(value,str) or not value or len(value)>8192:
                    increment(meta,'unclassifiable_attributes','unclassifiable_saturated');return
                normalized=re.sub(r'[\t\r\n]','',value).strip(''.join(chr(i) for i in range(33)))
                if re.match(r'(?i)^https:',normalized):
                    if not re.match(r'(?i)^https://',value) or re.search(r'[\x00-\x20\x7f\\]',value):
                        increment(meta['unresolved'],pos,'unresolved_saturated');return
                    if meta['sent_count']>=MAX_MESSAGES:
                        meta['message_limited']=True;increment(meta,'dropped','dropped_saturated');return
                    message=(json.dumps({'seq':meta['sent_count'],'position':pos,'value':value},ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')
                    if meta['sent_bytes']+len(message)>MAX_PRIVATE:
                        meta['byte_limited']=True;increment(meta,'dropped','dropped_saturated');return
                    private.write(message);meta['sent_bytes']+=len(message);meta['sent_count']+=1
                elif normalized.startswith('//'):increment(meta['excluded'],'PROTOCOL_RELATIVE_UNRESOLVED','excluded_saturated')
                elif re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:',normalized):increment(meta['excluded'],'NON_HTTPS','excluded_saturated')
                else:increment(meta['excluded'],'RELATIVE_UNRESOLVED','excluded_saturated')
        # Only the class factory is augmented; every parent lexical operation,
        # limit, raw-text rule, header parser and fixed base result is unchanged.
        parent['scan'].__globals__['Scan']=Observed
        base=parent['scan'](v['html'],v['link'])
    print(json.dumps({'base_scan':base,'origin_capture':meta},separators=(',',':')))
if __name__=='__main__':
    try:main()
    except Exception:print('{"error":"PARSER"}');sys.exit(1)
