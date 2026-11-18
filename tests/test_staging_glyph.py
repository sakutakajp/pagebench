import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import staging_glyph_pilot as p
from psi_transport import validate
from test_core import response

class GlyphTests(unittest.TestCase):
    def fixture(self):
        urls = list(p.URLS)+[p.SITE+'/fixture/'+str(i)+'/' for i in range(2592)]
        return ('<urlset xmlns="'+p.NS[1:-1]+'">'+''.join('<url><loc>'+u+'</loc></url>' for u in urls)+'</urlset>').encode()

    def plan(self):
        calls=[]
        def loader(u):
            calls.append(u)
            return self.fixture() if u==p.START else b'<!DOCTYPE html><html></html>'
        plan=p.prepare(p.START, loader)
        self.assertEqual(calls,[p.START,*p.URLS])
        return plan

    def test_plan_scope(self):
        plan=self.plan()
        self.assertEqual(plan['sitemap_count'],2594)
        for start in [None,'https://hirameki.dev/sitemap.xml',p.START+'?x=1']:
            with self.assertRaises(ValueError):p.prepare(start,lambda u: self.fail('network'))
        for raw in [self.fixture().replace(b'/schemas/',b'/schema/'),b'<!DOCTYPE x>'+self.fixture(),self.fixture().replace(b'https://staging.hirameki.dev',b'https://hirameki.dev',1)]:
            with self.assertRaises(Exception):p.prepare(p.START,lambda u:raw)

    def test_two_calls_resume_no_leak(self):
        plan=self.plan();calls=[]
        def send(u,k):calls.append(u);return validate(response(u),u),None,False
        with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'PSI_API_KEY':'synthetic-only-token'}):
            f=Path(d)/'result.json'
            a=p.execute(plan,f,send);b=p.execute(plan,f,send)
            self.assertEqual(a,b);self.assertEqual(calls,list(p.URLS));self.assertEqual(a['status'],'complete')
            self.assertNotIn('synthetic-only-token',f.read_text());self.assertNotIn('lighthouseResult',f.read_text())
            self.assertEqual(f.stat().st_mode&0o777,0o600)

    def test_failure_interruption_absent_secret(self):
        plan=self.plan()
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'result.json';calls=[]
            def fail(u,k):calls.append(u);return None,{'error_enum':'RESOURCE_EXHAUSTED','http_status':429},True
            with patch.dict(os.environ,{'PSI_API_KEY':'synthetic-only-token'}):
                self.assertEqual(p.execute(plan,f,fail)['status'],'failed');p.execute(plan,f,fail)
            self.assertEqual(len(calls),1)
            f.unlink()
            with patch.dict(os.environ,{},clear=True):
                with self.assertRaisesRegex(ValueError,'SECRET_ABSENT'):p.execute(plan,f,lambda *a:self.fail('network'))
            p.write(f,{'plan_hash':plan['sha256'],'status':'in_flight','results':[]})
            self.assertEqual(p.execute(plan,f,lambda *a:self.fail('retry'))['status'],'in_flight')
            broken=dict(plan,urls=['https://hirameki.dev/ja/'])
            with self.assertRaises(ValueError):p.execute(broken,f,fail)

    def test_preflight_redirect(self):
        import urllib.error
        def loader(u):
            if u==p.START:return self.fixture()
            raise urllib.error.HTTPError(u,302,'redirect',{},None)
        with self.assertRaises(urllib.error.HTTPError):p.prepare(p.START,loader)
