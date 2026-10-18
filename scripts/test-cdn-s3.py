#!/usr/bin/env python3
"""Exercise real botocore signing and Access headers without making requests."""
import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cdn_s3', Path(__file__).with_name('cdn-s3.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HaltBeforeNetwork(Exception):
    pass


class AccessTransport(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test-writer', 'AWS_SECRET_ACCESS_KEY': 'test-secret',
            'AWS_EC2_METADATA_DISABLED': 'true', 'CF_ACCESS_CLIENT_ID': 'test-access-id',
            'CF_ACCESS_CLIENT_SECRET': 'test-access-secret',
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_access_headers_are_added_after_s3_signing(self):
        client = module.client()
        captured = []

        def inspect(request, **_):
            captured.append(request)
            raise HaltBeforeNetwork()

        client.meta.events.register_last('before-send.s3.GetObject', inspect)
        with self.assertRaises(HaltBeforeNetwork):
            client.get_object(Bucket=module.BUCKET, Key='tobor-kit/test.json')
        request = captured[0]
        headers = {str(k).lower(): v.decode() if isinstance(v, bytes) else v for k, v in request.headers.items()}
        self.assertEqual(headers['cf-access-client-id'], 'test-access-id')
        self.assertEqual(headers['cf-access-client-secret'], 'test-access-secret')
        self.assertIn('AWS4-HMAC-SHA256', headers['authorization'])
        self.assertNotIn('cf-access-client', headers['authorization'].lower())
        self.assertEqual(request.url, 'https://minio.noizu.com/cdn-derobot-is/tobor-kit/test.json')

    def test_access_headers_never_follow_foreign_redirect(self):
        client = module.client()
        request = SimpleNamespace(url='https://attacker.invalid/object', headers={})
        with self.assertRaises(ValueError):
            client.meta.events.emit('before-send.s3.GetObject', request=request)
        self.assertEqual(request.headers, {})

    def test_prefix_scope_and_required_access_credentials(self):
        for bucket, key in [('another-bucket', 'tobor-kit/x'), (module.BUCKET, 'another-project/x')]:
            with self.assertRaises(ValueError):
                module.scoped_key(bucket, key)
        with patch.dict(os.environ, {'CF_ACCESS_CLIENT_SECRET': ''}):
            with self.assertRaises(ValueError):
                module.client()


if __name__ == '__main__':
    unittest.main(verbosity=2)
