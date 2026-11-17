#!/usr/bin/env python3
"""Official PSI transport and strict response contract. No raw persistence."""
import datetime as dt
import json
import math
import os
import re
import signal
import ssl
import sqlite3
import tempfile
import urllib.error
import urllib.parse
import urllib.request

COLUMNS = ['provider', 'strategy', 'url', 'fetched_at', 'lighthouse_version',
           'score', 'raw_score', 'config_json']
ENUMS = {'INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED',
         'NOT_FOUND', 'RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'ABORTED',
         'OUT_OF_RANGE', 'UNIMPLEMENTED', 'INTERNAL', 'UNAVAILABLE',
         'DATA_LOSS', 'DEADLINE_EXCEEDED', 'CANCELLED', 'UNKNOWN'}
FAILURE_ENUMS = ENUMS | {'UNEXPECTED_STATUS', 'TIMEOUT', 'RESPONSE_TOO_LARGE',
    'REFLECTED_AUTH_RESPONSE_REJECTED', 'TRANSPORT_OR_RESPONSE_ERROR',
    'CANONICAL_MISMATCH', 'LIGHTHOUSE_RUNTIME_ERROR', 'MOBILE_CONTRACT_MISMATCH',
    'INVALID_SCORE', 'INVALID_VERSION', 'INVALID_FETCH_TIME',
    'MISSING_OR_INVALID_RESPONSE_FIELD', 'INTERRUPTED_OUTCOME_UNKNOWN'}

class SafeError(Exception):
    pass

def normalized_time(value):
    if not isinstance(value, str) or not re.fullmatch(
        r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})', value
    ):
        raise SafeError('INVALID_FETCH_TIME')
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(
            dt.timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')
    except ValueError:
        raise SafeError('INVALID_FETCH_TIME') from None

def validate(data, url):
    try:
        lr = data['lighthouseResult']
        if data['id'] != url or any(lr[k] != url for k in (
            'requestedUrl', 'finalUrl', 'finalDisplayedUrl', 'mainDocumentUrl')):
            raise SafeError('CANONICAL_MISMATCH')
        if lr.get('runtimeError') is not None:
            raise SafeError('LIGHTHOUSE_RUNTIME_ERROR')
        cfg = lr['configSettings']
        if any(cfg.get(k) != 'mobile' for k in ('formFactor', 'emulatedFormFactor')):
            raise SafeError('MOBILE_CONTRACT_MISMATCH')
        selected = {k: cfg[k] for k in ('formFactor', 'emulatedFormFactor', 'gatherMode',
            'throttlingMethod', 'throttling', 'screenEmulation', 'emulatedUserAgent') if k in cfg}
        # Retain only JSON primitives/objects actually reported, with a bounded size.
        if len(json.dumps(selected, allow_nan=False)) > 16384:
            raise SafeError('MOBILE_CONTRACT_MISMATCH')
        score = lr['categories']['performance']['score']
        if type(score) not in (float, int) or not math.isfinite(score) or not 0 <= score <= 1:
            raise SafeError('INVALID_SCORE')
        version = lr['lighthouseVersion']
        if not isinstance(version, str) or len(version) > 32 or not re.fullmatch(r'\d+\.\d+\.\d+', version):
            raise SafeError('INVALID_VERSION')
        # SQLite rounds ties away from zero. Use its exact bound expression,
        # including binary floating multiplication, to match the table CHECK.
        connection = sqlite3.connect(':memory:')
        try:
            rounded = connection.execute('SELECT CAST(round(? * 100) AS INTEGER)', (score,)).fetchone()[0]
        finally:
            connection.close()
        return ['psi-api', 'mobile', url, normalized_time(lr['fetchTime']), version,
                rounded, score, json.dumps(selected, sort_keys=True, separators=(',', ':'))]
    except (KeyError, TypeError, AttributeError):
        raise SafeError('MISSING_OR_INVALID_RESPONSE_FIELD') from None

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def request(url, key):
    """One request, standard egress, default TLS trust, no redirects or retry."""
    def deadline(*unused):
        raise SafeError('TIMEOUT')
    old = signal.signal(signal.SIGALRM, deadline)
    signal.alarm(150)
    status = None
    try:
        endpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + urllib.parse.urlencode(
            {'url': url, 'strategy': 'mobile', 'category': 'performance'})
        opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(
            context=ssl.create_default_context()))
        req = urllib.request.Request(endpoint, headers={'X-Goog-Api-Key': key})
        try:
            with opener.open(req, timeout=120) as response:
                status = response.status
                raw = response.read(40 * 1024 * 1024 + 1)
        except urllib.error.HTTPError as exc:
            enum = 'UNKNOWN'
            try:
                candidate = json.loads(exc.read(1024 * 1024)).get('error', {}).get('status')
                if isinstance(candidate, str) and candidate in ENUMS:
                    enum = candidate
            except Exception:
                pass
            return None, {'http_status': exc.code, 'error_enum': enum}, (
                exc.code in (401, 403, 429) or enum in
                {'UNAUTHENTICATED', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED'})
        if status != 200:
            return None, {'http_status': status, 'error_enum': 'UNEXPECTED_STATUS'}, False
        if len(raw) > 40 * 1024 * 1024:
            raise SafeError('RESPONSE_TOO_LARGE')
        data = json.loads(raw)
        decoded = json.dumps(data, ensure_ascii=False)
        if key in decoded or key.encode() in raw or re.search(
            r'(?i)x-goog-api-key|authorization\s*["\x27]?\s*[:=]|AIza[0-9A-Za-z_-]{30,}|(?:secret|credential)[_-]placeholder', decoded
        ):
            raise SafeError('REFLECTED_AUTH_RESPONSE_REJECTED')
        return validate(data, url), None, False
    except SafeError as exc:
        return None, {'http_status': status, 'error_enum': str(exc)}, False
    except (TimeoutError,):
        return None, {'http_status': status, 'error_enum': 'TIMEOUT'}, False
    except Exception:
        return None, {'http_status': status, 'error_enum': 'TRANSPORT_OR_RESPONSE_ERROR'}, False
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)
