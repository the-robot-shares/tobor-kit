#!/usr/bin/env python3
"""Minimal S3 publisher transport through Cloudflare Access; credentials stay in env."""
import argparse
import mimetypes
import os
from pathlib import Path
import shutil
import sys
from urllib.parse import urlsplit

ENDPOINT = 'https://minio.noizu.com'
BUCKET = 'cdn-derobot-is'


def scoped_key(bucket, key):
    if bucket != BUCKET or not key.startswith('tobor-kit/'):
        raise ValueError('Object is outside the toolkit CDN prefix')
    return key


def client():
    import boto3
    from botocore.config import Config
    headers = {name: os.environ[variable] for name, variable in (
        ('CF-Access-Client-Id', 'CF_ACCESS_CLIENT_ID'),
        ('CF-Access-Client-Secret', 'CF_ACCESS_CLIENT_SECRET'))}
    if not all(headers.values()):
        raise ValueError('Cloudflare Access credentials are missing')
    result = boto3.client('s3', endpoint_url=ENDPOINT, region_name='us-east-1',
                          config=Config(signature_version='s3v4', s3={'addressing_style': 'path'},
                                        retries={'max_attempts': 2, 'mode': 'standard'},
                                        connect_timeout=15, read_timeout=60,
                                        request_checksum_calculation='when_required',
                                        response_checksum_validation='when_required'))

    def access_headers(request, **_):
        target = urlsplit(request.url)
        if target.scheme != 'https' or target.netloc != 'minio.noizu.com':
            raise ValueError('Refusing to forward Access credentials to another host')
        # Added after SigV4 signing: the edge may consume these before forwarding.
        request.headers.update(headers)

    result.meta.events.register('before-send.s3.*', access_headers)
    return result


def run(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint-url', choices=[ENDPOINT], required=True)
    services = parser.add_subparsers(dest='service', required=True)
    api = services.add_parser('s3api').add_subparsers(dest='operation', required=True)
    get = api.add_parser('get-object')
    get.add_argument('--bucket', required=True)
    get.add_argument('--key', required=True)
    get.add_argument('target')
    s3 = services.add_parser('s3').add_subparsers(dest='operation', required=True)
    cp = s3.add_parser('cp')
    cp.add_argument('source')
    cp.add_argument('target')
    cp.add_argument('--recursive', action='store_true')
    cp.add_argument('--exclude')
    cp.add_argument('--cache-control', required=True)
    cp.add_argument('--content-type')
    cp.add_argument('--only-show-errors', action='store_true')
    args = parser.parse_args(argv)
    if args.operation == 'get-object':
        key = scoped_key(args.bucket, args.key)
        response = client().get_object(Bucket=BUCKET, Key=key)
        with response['Body'] as body, open(args.target, 'wb') as output:
            shutil.copyfileobj(body, output)
        return
    target = urlsplit(args.target)
    if target.scheme != 's3':
        raise ValueError('Upload target must be an S3 object')
    prefix = scoped_key(target.netloc, target.path.lstrip('/'))
    source = Path(args.source)
    paths = sorted(path for path in source.rglob('*') if path.is_file()) if args.recursive else [source]
    remote = client()
    for path in paths:
        relative = path.relative_to(source).as_posix() if args.recursive else ''
        if args.recursive and relative == args.exclude:
            continue
        key = scoped_key(BUCKET, prefix.rstrip('/') + '/' + relative if args.recursive else prefix)
        content_type = args.content_type or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if path.suffix == '.js':
            content_type = 'text/javascript'
        with path.open('rb') as body:
            remote.put_object(Bucket=BUCKET, Key=key, Body=body,
                              ContentType=content_type, CacheControl=args.cache_control)


if __name__ == '__main__':
    try:
        run(sys.argv[1:])
    except Exception as error:
        # Never print exception text or a traceback: SDK messages may include headers.
        response = getattr(error, 'response', {})
        code = response.get('Error', {}).get('Code') if isinstance(response, dict) else None
        safe_codes = {'NoSuchKey', '404', 'AccessDenied', '403', 'InvalidAccessKeyId', 'SignatureDoesNotMatch'}
        print('S3 request failed (' + (code if code in safe_codes else type(error).__name__) + ')', file=sys.stderr)
        sys.exit(1)
