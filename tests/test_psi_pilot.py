import io
import json
import unittest
import urllib.error
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch
import psi_pilot as pilot
import psi_transport as transport
from test_core import response


class PilotTests(unittest.TestCase):
    def test_default_and_missing_key_never_request(self):
        with patch.object(pilot.os, 'environ', {}), patch.object(transport, 'request') as req:
            self.assertEqual(pilot.run()['status'], 'planned')
            self.assertEqual(pilot.run(True)['categories'], {'SECRET_ABSENT': 1})
            req.assert_not_called()

    def test_real_guarded_transport_three_calls_only_no_leak(self):
        token='synthetic-pilot-not-a-real-secret'
        calls=[]
        class Reply:
            status=200
            def __init__(self,url):self.url=url
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,*args):return json.dumps(response(self.url)).encode()
        class Opener:
            def open(self,request,timeout):
                calls.append(request)
                return Reply(parse_qs(urlsplit(request.full_url).query)['url'][0])
        with patch.object(pilot.os,'environ',{'PSI_API_KEY':token}), patch.object(transport.urllib.request,'build_opener',return_value=Opener()) as factory:
            result=pilot.run(True)
        self.assertEqual(len(calls),3)
        self.assertEqual(result['validated'],3)
        self.assertEqual(result['mean_score'],82)
        self.assertEqual(result['pending'],0)
        self.assertEqual(result['status'],'complete')
        self.assertNotIn(token,json.dumps(result))
        for request,url in zip(calls,pilot.URLS):
            endpoint=urlsplit(request.full_url)
            self.assertEqual((endpoint.scheme,endpoint.netloc,endpoint.path),('https','www.googleapis.com','/pagespeedonline/v5/runPagespeed'))
            self.assertEqual(parse_qs(endpoint.query),{'url':[url],'strategy':['mobile'],'category':['performance']})
            self.assertEqual(request.get_header('X-goog-api-key'),token)
            self.assertNotIn(token,request.full_url)
        self.assertIsInstance(factory.call_args.args[0],transport.NoRedirect)
        self.assertTrue(factory.call_args.args[1]._context.check_hostname)

    def test_redirect_quota_and_quarantine_stop_without_retry(self):
        token='synthetic-pilot-not-a-real-secret'
        for status in [302,401,403,429]:
            with patch.object(pilot.os,'environ',{'PSI_API_KEY':token}), patch.object(transport.urllib.request,'build_opener') as factory:
                factory.return_value.open.side_effect=urllib.error.HTTPError('https://www.googleapis.com',status,'',{},io.BytesIO(b'{"error":{"status":"UNKNOWN"}}'))
                result=pilot.run(True)
                self.assertEqual(factory.return_value.open.call_count,1)
                self.assertEqual(result['failed'],1)
                self.assertEqual(result['pending'],2)
                self.assertIsNone(result['mean_score'])
        for code in ['REFLECTED_AUTH_RESPONSE_REJECTED',token]:
            with patch.object(pilot.os,'environ',{'PSI_API_KEY':token}), patch.object(transport,'request',return_value=(None,{'error_enum':code},False)) as req:
                result=pilot.run(True)
                self.assertEqual(req.call_count,1)
                self.assertNotIn(token,json.dumps(result))
                self.assertEqual(result['status'],'failed')

    def test_invalid_untrusted_score_is_not_success(self):
        row=['psi-api','mobile',pilot.URLS[0],'2026-01-01T00:00:00.000000Z','13.6.0',0,float('nan'),'{}']
        with patch.object(pilot.os,'environ',{'PSI_API_KEY':'synthetic-only'}),patch.object(transport,'request',return_value=(row,None,False)) as req:
            result=pilot.run(True)
            self.assertEqual(req.call_count,1)
            self.assertEqual(result['validated'],0)
            self.assertIsNone(result['mean_score'])
