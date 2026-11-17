import json
from psi_transport import validate
def compare(a,b):
    if a['kind']!=b['kind']: raise ValueError('SYNTHETIC_PRODUCTION_MIX')
    def rows(s):
        for x in s['rows']:
            if not isinstance(x,list) or len(x)!=8 or x[:2]!=['psi-api','mobile'] or x[2] not in s['plan']['urls']: raise ValueError('INVALID_ROW')
            url=x[2]
            lr={'requestedUrl':url,'finalUrl':url,'finalDisplayedUrl':url,'mainDocumentUrl':url,
                'fetchTime':x[3],'lighthouseVersion':x[4],'categories':{'performance':{'score':x[6]}},'configSettings':json.loads(x[7])}
            if validate({'id':url,'lighthouseResult':lr},url)!=x: raise ValueError('INVALID_ROW')
        r={x[2]:x for x in s['rows']}
        if len(r)!=len(s['rows']): raise ValueError('DUPLICATE_OBSERVATION')
        return r
    aa,bb=rows(a),rows(b); common=sorted(set(aa)&set(bb)); compatible=[]; mismatch=[]
    for u in common:
        if (aa[u][0:2],aa[u][4],json.loads(aa[u][7]))==(bb[u][0:2],bb[u][4],json.loads(bb[u][7])): compatible.append(u)
        else: mismatch.append(u)
    def avg(rs,urls): return sum(rs[u][6]*100 for u in urls)/len(urls) if urls else None
    def full(s,r):
        target=set(s['plan']['urls']); complete=set(r)==target
        return {'target_count':len(target),'measured_count':len(r),'unmeasured_count':len(target-set(r)),
                'full_set_score':avg(r,sorted(target)) if complete else None,'measured_subset_score':avg(r,sorted(r))}
    return {'same_manifest':a['plan']['manifest_hash']==b['plan']['manifest_hash'],
            'same_url_set':set(a['plan']['urls'])==set(b['plan']['urls']),
            'before':full(a,aa),'after':full(b,bb),'common_count':len(common),'comparable_count':len(compatible),
            'version_or_settings_mismatch':mismatch,'common_score_before':avg(aa,compatible),'common_score_after':avg(bb,compatible),
            'rows':[{'url':u,'before':aa[u][5],'after':bb[u][5],'delta':bb[u][5]-aa[u][5]} for u in compatible]}
