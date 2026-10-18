#!/usr/bin/env python3
"""Hermetic publisher contract tests; no network, cloud credentials or uploads.

Run: python3 scripts/test-publish-lit-cdn.py
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SHA = 'a' * 40
SOURCE = Path(__file__).with_name('publish-lit-cdn.sh')
STUB = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['CALL_LOG'], 'a') as stream:
    stream.write(json.dumps([name, *args]) + '\n')
scenario = os.environ['SCENARIO']
if name == 'aws':
    if 'get-object' in args:
        if scenario in ('missing', 'missing404', 'stale', 'cdn_failure', 'upload_failure'):
            code = '404' if scenario == 'missing404' else 'NoSuchKey'
            print(f'An error occurred ({code}) when calling the GetObject operation', file=sys.stderr)
            sys.exit(254)
        if scenario in ('denied', 'network', 'malformed'):
            print({'denied': 'An error occurred (AccessDenied) when calling the GetObject operation',
                   'network': 'Could not connect to the endpoint URL',
                   'malformed': 'Unable to parse response: invalid XML'}[scenario], file=sys.stderr)
            sys.exit(254)
        target = pathlib.Path(args[-1])
        target.write_text(pathlib.Path('web/cdn-dist/manifest.json').read_text()
                          if scenario == 'matching' else '{"sha":"different"}\n')
        sys.exit(0)
    if 'cp' in args:
        sys.exit(1 if scenario == 'upload_failure' else 0)
    sys.exit(99)
if name == 'curl':
    sys.exit(22 if scenario == 'cdn_failure' else 0)
if name == 'gh':
    print('b' * 40 if scenario == 'stale' and '/git/ref/' in ' '.join(args)
          else '1' if '/compare/' in ' '.join(args) else 'a' * 40)
    sys.exit(0)
sys.exit(99)
'''


class PublisherContract(unittest.TestCase):
    def run_case(self, scenario, invalid_identity=False):
        with tempfile.TemporaryDirectory(prefix='lit-cdn-test-') as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            shutil.copyfile(SOURCE, root / 'scripts/publish-lit-cdn.sh')
            (root / 'scripts/cdn-s3.py').write_text("import subprocess,sys; sys.exit(subprocess.call(['aws', *sys.argv[1:]]))\n")
            dist = root / 'web/cdn-dist'
            dist.mkdir(parents=True)
            (dist / 'manifest.json').write_text(json.dumps({
                'sha': 'c' * 40 if invalid_identity else SHA,
                'baseUrl': f'https://cdn.derobot.is/tobor-kit/sha-{SHA}/',
            }) + '\n')
            (dist / 'index.js').write_text('export {};\n')
            binaries = root / 'bin'
            binaries.mkdir()
            for name in ('aws', 'gh', 'curl'):
                path = binaries / name
                path.write_text(STUB)
                path.chmod(0o755)
            log = root / 'calls.jsonl'
            result = subprocess.run(['bash', str(root / 'scripts/publish-lit-cdn.sh'), SHA],
                                    env={**os.environ, 'PATH': f'{binaries}:{os.environ["PATH"]}',
                                         'AWS_ACCESS_KEY_ID': 'test-only',
                                         'AWS_SECRET_ACCESS_KEY': 'test-only',
                                         'GH_REPO': 'test/repo', 'SCENARIO': scenario,
                                         'CALL_LOG': str(log), 'GITHUB_STEP_SUMMARY': ''},
                                    text=True, capture_output=True, timeout=15)
            calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return result, calls

    def uploads(self, calls):
        return [call for call in calls if call[0] == 'aws' and 'cp' in call]

    def test_missing_manifest_uploads_files_then_manifest_then_latest(self):
        for scenario in ('missing', 'missing404'):
            with self.subTest(scenario=scenario):
                result, calls = self.run_case(scenario)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(calls[0][0], 'aws')
                self.assertIn('get-object', calls[0])
                uploads = self.uploads(calls)
                self.assertEqual(len(uploads), 3)
                self.assertIn('--recursive', uploads[0])
                self.assertIn('--exclude', uploads[0])
                self.assertIn('manifest.json', uploads[0])
                self.assertIn(f's3://cdn-derobot-is/tobor-kit/sha-{SHA}/manifest.json', uploads[1])
                self.assertIn('s3://cdn-derobot-is/tobor-kit/latest.json', uploads[2])
                self.assertLess(next(i for i, c in enumerate(calls) if c[0] == 'curl'), calls.index(uploads[2]))

    def test_identical_retry_only_updates_latest(self):
        result, calls = self.run_case('matching')
        self.assertEqual(result.returncode, 0, result.stderr)
        uploads = self.uploads(calls)
        self.assertEqual(len(uploads), 1)
        self.assertIn('s3://cdn-derobot-is/tobor-kit/latest.json', uploads[0])

    def test_immutable_mismatch_denied_network_and_malformed_fail_closed(self):
        for scenario in ('mismatch', 'denied', 'network', 'malformed'):
            with self.subTest(scenario=scenario):
                result, calls = self.run_case(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.uploads(calls), [])
                self.assertFalse(any(call[0] in ('curl', 'gh') for call in calls))

    def test_stale_run_does_not_update_latest(self):
        result, calls = self.run_case('stale')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.uploads(calls)), 2)
        self.assertFalse(any('s3://cdn-derobot-is/tobor-kit/latest.json' in c for c in calls))

    def test_upload_or_cdn_failure_never_updates_latest(self):
        for scenario in ('upload_failure', 'cdn_failure'):
            with self.subTest(scenario=scenario):
                result, calls = self.run_case(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any('s3://cdn-derobot-is/tobor-kit/latest.json' in c for c in calls))

    def test_artifact_identity_mismatch_fails_before_network(self):
        result, calls = self.run_case('missing', invalid_identity=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
