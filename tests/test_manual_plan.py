import tempfile
import unittest
from unittest.mock import patch
import manual_plan


class ManualPlanTests(unittest.TestCase):
    def test_large_sitemap_is_capped_before_plan_and_never_calls_psi(self):
        xml = ('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
               ''.join(f'<url><loc>https://example.org/p{i}/</loc></url>' for i in range(1001)) + '</urlset>').encode()
        with tempfile.TemporaryDirectory() as folder, patch('psi.request') as request, patch('psi.os.environ', {}):
            result = manual_plan.plan('https://example.org/sitemap.xml', folder, lambda _: xml)
            self.assertEqual(result['sitemap_count'], 1001)
            self.assertEqual(result['planned_count'], 3)
            self.assertEqual(result['google_psi_calls'], 0)
            request.assert_not_called()

    def test_missing_and_empty_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                manual_plan.plan(None, folder)
            with self.assertRaises(ValueError):
                manual_plan.plan('https://example.org/sitemap.xml', folder,
                    lambda _: b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
