import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import urllib.error
import common
import psi
import psi_transport as t
import sitemap
from compare import compare

SITE='https://example.org'
URL=SITE+'/日本/'
ENC=SITE+'/%E6%97%A5%E6%9C%AC/'

def response(url=ENC, score=.815):
    return {'id':url,'lighthouseResult':{'requestedUrl':url,'finalUrl':url,'finalDisplayedUrl':url,'mainDocumentUrl':url,
        'fetchTime':'2026-01-01T00:00:00Z','lighthouseVersion':'13.6.0',
        'configSettings':{'formFactor':'mobile','emulatedFormFactor':'mobile'},'categories':{'performance':{'score':score}}}}

def manifest(n=1):
    m={'schema':1,'origin':SITE,'records':[{'url':SITE+f'/p{i}/'} for i in range(n)]}
    m['sha256']=common.digest(m);return m

class Tests(unittest.TestCase):
    def test_canonical(self):
        self.assertEqual(common.canonical(URL,SITE),ENC)
        self.assertEqual(common.canonical(ENC,SITE),ENC)
        for value in ['/a/../','/%2F/','/%252F/','/%e6%97%a5/','/%61/','/a/?x','/a/#x','//a/','/%FF/','/a\\b/']:
            with self.assertRaises((ValueError,UnicodeError)):common.canonical(SITE+value,SITE)
        with self.assertRaises(ValueError):common.canonical('https://other.example/a/',SITE)
    def test_response(self):
        row=t.validate(response(),ENC); self.assertEqual(row[5],82)
        self.assertNotIn('throttling',row[7])
        for key in ['requestedUrl','finalUrl','mainDocumentUrl','finalDisplayedUrl']:
            d=response();d['lighthouseResult'][key]+='x'
            with self.assertRaises(t.SafeError):t.validate(d,ENC)
        for score in [None,True,float('nan'),float('inf'),-1,1.1]:
            with self.assertRaises(t.SafeError):t.validate(response(score=score),ENC)
        d=response();d['lighthouseResult']['runtimeError']={'code':'x'}
        with self.assertRaises(t.SafeError):t.validate(d,ENC)
    def test_transport_guard(self):
        synthetic='synthetic-test-token-not-a-real-secret'
        class R:
            status=200
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def read(self,*a):return json.dumps(self.data).encode()
        class O:
            def open(self,req,timeout):
                self.req=req;self.timeout=timeout;return r
        r=R();o=O()
        with patch.object(t.urllib.request,'build_opener',return_value=o) as build:
            r.data=response();row,failure,halt=t.request(ENC,synthetic)
            self.assertIsNotNone(row);self.assertNotIn(synthetic,json.dumps(row))
            self.assertTrue(o.req.full_url.startswith('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?'))
            self.assertNotIn(synthetic,o.req.full_url)
            self.assertEqual(o.req.get_header('X-goog-api-key'),synthetic)
            self.assertIsInstance(build.call_args.args[0],t.NoRedirect)
            self.assertTrue(build.call_args.args[1]._context.check_hostname)
            for reflected in [synthetic,'x-goog-api-key','authorization: token','credential_placeholder','AIza'+'x'*35]:
                r.data=response();r.data['extra']=reflected
                self.assertEqual(t.request(ENC,synthetic)[1]['error_enum'],'REFLECTED_AUTH_RESPONSE_REJECTED')
        self.assertIsNone(t.NoRedirect().redirect_request(None,None,302,'',{},'https://elsewhere.example'))
        for code in [401,403,429]:
            with patch.object(t.urllib.request,'build_opener') as b:
                b.return_value.open.side_effect=urllib.error.HTTPError('https://www.googleapis.com',code,'',{},io.BytesIO(b'{"error":{"status":"RESOURCE_EXHAUSTED"}}'))
                self.assertTrue(t.request(ENC,synthetic)[2])
    def test_dry_secret_absent(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(psi.os,'environ',{}) ,patch.object(psi,'request') as req:
            self.assertEqual(psi.run(manifest(),folder)['terminal_status'],'planned')
            with self.assertRaises(t.SafeError):psi.run(manifest(),folder,execute=True)
            req.assert_not_called()
    def test_runtime_secret_never_persisted(self):
        token='synthetic-runtime-token-not-a-real-secret'
        with tempfile.TemporaryDirectory() as d, patch.object(psi.os,'environ',{'PSI_API_KEY':token}), patch.object(psi,'request') as req:
            url=manifest()['records'][0]['url']
            req.return_value=(t.validate(response(url),url),None,False)
            result=psi.run(manifest(),d,execute=True)
            self.assertEqual(req.call_args.args,(url,token))
            self.assertNotIn(token,json.dumps(result))
            for p in Path(d).iterdir():self.assertNotIn(token,p.read_text())

    def test_batch_resume_identity_and_quota(self):
        m=manifest(1001);calls=[]
        def fake(url,key):
            self.assertIsNone(key);calls.append(url);return t.validate(response(url),url),None,False
        with tempfile.TemporaryDirectory() as d:
            s=psi.run(m,d,execute=True,transport=fake,kind='synthetic')
            self.assertEqual(len(calls),10);self.assertEqual(len(s['pending_urls']),991)
            s=psi.run(m,d,execute=True,transport=fake,kind='synthetic');self.assertEqual(len(set(calls)),20)
            self.assertEqual(Path(d,'run.json').stat().st_mode&0o777,0o600)
            s['entries'][m['records'][20]['url']]='in_flight';common.write(Path(d,'run.json'),s)
            s=psi.run(m,d,execute=True,transport=fake,kind='synthetic');self.assertNotIn(m['records'][20]['url'],calls)
            with self.assertRaises(ValueError):psi.run(manifest(2),d)
            with self.assertRaises(ValueError):psi.run(m,d,execute=True)
        with tempfile.TemporaryDirectory() as d:
            quota=lambda *_:(None,{'http_status':429,'error_enum':'RESOURCE_EXHAUSTED'},True)
            s=psi.run(m,d,execute=True,transport=quota,kind='synthetic')
            self.assertEqual(len(s['entries']),1)
            s=psi.run(m,d,execute=True,transport=fake,kind='synthetic');self.assertEqual(len(s['entries']),1)
    def test_compare_coverage(self):
        row=t.validate(response(),ENC)
        a={'kind':'synthetic','rows':[row],'plan':{'urls':[ENC,SITE+'/missing/'],'manifest_hash':'x'}}
        b=copy.deepcopy(a);b['rows'][0][4]='13.7.0'
        r=compare(a,b);self.assertIsNone(r['before']['full_set_score']);self.assertEqual(r['comparable_count'],0)
        b=copy.deepcopy(a);self.assertEqual(compare(a,b)['comparable_count'],1)
        b['kind']='production'
        with self.assertRaises(ValueError):compare(a,b)
    def test_sitemap(self):
        ns='http://www.sitemaps.org/schemas/sitemap/0.9'
        def xml(tag,values):
            child='url' if tag=='urlset' else 'sitemap'
            return (f'<{tag} xmlns="{ns}">'+''.join(f'<{child}><loc>{v}</loc></{child}>' for v in values)+f'</{tag}>').encode()
        docs={SITE+'/sitemap.xml':xml('sitemapindex',[SITE+'/part.xml']),SITE+'/part.xml':xml('urlset',[SITE+f'/p{i}/' for i in range(1001)]+[URL,ENC])}
        a=sitemap.generate(SITE+'/sitemap.xml',docs.__getitem__);b=sitemap.generate(SITE+'/sitemap.xml',docs.__getitem__)
        self.assertEqual(a,b);self.assertEqual(len(a['records']),1002)
        for raw in [b'<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x/>',b'<bad/>',b'\x00x',xml('urlset',['https://other.example/a/']),b'<broken']:
            with self.assertRaises(Exception):sitemap.generate(SITE+'/sitemap.xml',lambda _:raw)
        for start in [None,'http://example.org/sitemap.xml','https://user:pass@example.org/x','https://example.org:444/x','https://example.org/x?key=x']:
            with self.assertRaises(Exception):sitemap.generate(start,lambda _:b'')
    def test_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d,'m.json');m=manifest();common.write(p,m);self.assertEqual(common.manifest(p),m)
            m['records'].append(m['records'][0]);common.write(p,m)
            with self.assertRaises(ValueError):common.manifest(p)

if __name__=='__main__':unittest.main()
