"""Protocol namespace and a narrow observed compatibility exception."""
import tempfile
import unittest
from diagnostics import DiagnosticError
from manual_plan import plan
from sitemap import generate


class NamespaceTests(unittest.TestCase):
    def test_literal_official_and_observed_compatibility(self):
        # Official https://www.sitemaps.org/protocol.html uses plural /schemas/.
        official = b'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.org/</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://example.org/%E6%97%A5%E6%9C%AC/</loc></url>
</urlset>'''
        compatible = official.replace(b'/schemas/', b'/schema/')
        for xml in [official, compatible]:
            with tempfile.TemporaryDirectory() as folder:
                result = plan('https://example.org/sitemap.xml', folder, lambda _: xml)
            self.assertEqual(result['sitemap_count'], 2)
            self.assertEqual(result['planned_count'], 2)
            self.assertEqual(result['google_psi_calls'], 0)

    def test_unknown_or_mixed_namespace_rejected(self):
        samples = [
            b'<urlset xmlns="https://untrusted.example/schema"/>',
            b'<urlset/>',
            b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url xmlns="http://www.sitemaps.org/schema/sitemap/0.9"><loc>https://example.org/</loc></url></urlset>',
            b'<urlset xmlns="http://www.sitemaps.org/schema/sitemap/0.9"><url><loc>https://example.org/</loc><lastmod xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">2026-01-01</lastmod></url></urlset>'
        ]
        for xml in samples:
            with self.assertRaises(DiagnosticError) as result:
                generate('https://example.org/sitemap.xml', lambda _: xml)
            self.assertEqual(result.exception.public(), {'status': 'failed', 'stage': 'xml', 'reason': 'XML_INVALID'})

    def test_compatibility_index(self):
        docs = {
            'https://example.org/sitemap.xml': b'<sitemapindex xmlns="http://www.sitemaps.org/schema/sitemap/0.9"><sitemap><loc>https://example.org/part.xml</loc></sitemap></sitemapindex>',
            'https://example.org/part.xml': b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.org/</loc></url></urlset>'}
        self.assertEqual(len(generate('https://example.org/sitemap.xml', docs.__getitem__)['records']),1)
