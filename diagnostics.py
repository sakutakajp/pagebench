"""Fixed public error categories; never serialize exception text, bodies or URLs."""
from contextlib import contextmanager
import socket
import ssl
import urllib.error
from xml.etree.ElementTree import ParseError


class DiagnosticError(ValueError):
    def __init__(self, stage, code, http_status=None):
        super().__init__(code)
        self.stage, self.code, self.http_status = stage, code, http_status

    def public(self):
        value = {'status': 'failed', 'stage': self.stage, 'reason': self.code}
        if self.http_status is not None:
            value['http_status'] = self.http_status
        return value


@contextmanager
def stage(name):
    assert name in {'config', 'fetch', 'xml', 'content', 'plan'}
    try:
        yield
    except DiagnosticError:
        raise
    except Exception as exc:
        status = None
        cause = exc.reason if isinstance(exc, urllib.error.URLError) else exc
        if isinstance(exc, urllib.error.HTTPError):
            code = 'HTTP_ERROR'
            if type(exc.code) is int and 100 <= exc.code <= 599:
                status = exc.code
        elif isinstance(cause, ssl.SSLError):
            code = 'TLS_ERROR'
        elif isinstance(cause, socket.gaierror):
            code = 'DNS_ERROR'
        elif isinstance(cause, TimeoutError):
            code = 'TIMEOUT'
        elif isinstance(exc, urllib.error.URLError):
            code = 'NETWORK_ERROR'
        elif isinstance(exc, (ParseError, UnicodeError)):
            code = 'XML_INVALID' if name == 'xml' else 'CONTENT_INVALID'
        else:
            # Exception strings are compared only to fixed internal constants.
            known = {'SITEMAP_URL_UNSET': 'SITEMAP_URL_MISSING',
                     'NONPUBLIC_ADDRESS': 'NONPUBLIC_ADDRESS',
                     'SITEMAP_TOO_LARGE': 'SIZE_LIMIT', 'SITEMAP_SIZE': 'SIZE_LIMIT',
                     'SITEMAP_LIMIT': 'FETCH_LIMIT', 'URL_LIMIT': 'URL_LIMIT',
                     'EMPTY_SITEMAP': 'EMPTY_SITEMAP', 'UNSAFE_XML': 'XML_UNSAFE'}
            code = known.get(str(exc), {'config': 'CONFIG_INVALID', 'fetch': 'FETCH_FAILED',
                'xml': 'XML_INVALID', 'content': 'CONTENT_INVALID', 'plan': 'PLAN_FAILED'}[name])
        raise DiagnosticError(name, code, status) from None
