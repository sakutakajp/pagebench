import json
import ssl
import socket
import unittest
import urllib.error
from diagnostics import DiagnosticError
from sitemap import generate


class DiagnosticsTests(unittest.TestCase):
    def test_config(self):
        for value, code in [(None, 'SITEMAP_URL_MISSING'), ('https://user:synthetic-private@example.org/x', 'CONFIG_INVALID')]:
            with self.assertRaises(DiagnosticError) as result:
                generate(value)
            self.assertEqual(result.exception.code, code)
            self.assertNotIn('synthetic-private', json.dumps(result.exception.public()))

    def test_transport_and_xml_safe_categories(self):
        cases = [(urllib.error.HTTPError('https://user:synthetic-private@example.org',403,'synthetic-private',{},None),'HTTP_ERROR'),
                 (urllib.error.URLError(ssl.SSLError('synthetic-private')),'TLS_ERROR'),
                 (urllib.error.URLError(socket.gaierror('synthetic-private')),'DNS_ERROR'),
                 (TimeoutError('synthetic-private'),'TIMEOUT')]
        for error, code in cases:
            def loader(_): raise error
            with self.assertRaises(DiagnosticError) as result:
                generate('https://example.org/sitemap.xml',loader)
            self.assertEqual(result.exception.code,code)
            self.assertNotIn('synthetic-private',json.dumps(result.exception.public()))
        for raw in [b'<broken',b'<!DOCTYPE x><x/>',b'\xff']:
            with self.assertRaises(DiagnosticError) as result:
                generate('https://example.org/sitemap.xml',lambda _:raw)
            self.assertEqual(result.exception.stage,'xml')

    def test_content_stage(self):
        raw=b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://other.example/x/</loc></url></urlset>'
        with self.assertRaises(DiagnosticError) as result:
            generate('https://example.org/sitemap.xml',lambda _:raw)
        self.assertEqual(result.exception.public(),{'status':'failed','stage':'content','reason':'CONTENT_INVALID'})
