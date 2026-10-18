import { describe, expect, it } from 'vitest';
import { presignUrl, r2Url } from './r2.js';

describe('R2 서명 주소 (AWS 서명 버전 4)', () => {
	it('AWS 문서의 예와 같은 서명을 만든다', () => {
		// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
		const url = presignUrl({
			method: 'GET',
			host: 'examplebucket.s3.amazonaws.com',
			path: '/test.txt',
			region: 'us-east-1',
			accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
			secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
			expiresIn: 86400,
			now: new Date('2013-05-24T00:00:00Z'),
		});
		expect(url).toBe(
			'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
				'&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
				'&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
				'&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
		);
	});

	it('R2: 계정 주소, 버킷 경로, region auto, 크기를 서명에 넣는다', () => {
		const url = new URL(
			r2Url(
				{ accountId: 'acc', accessKeyId: 'AK', secretAccessKey: 'SK', bucket: 'macfolio-files' },
				'PUT',
				'resume/a b.pdf',
				300,
				{ 'content-length': '1234' },
				new Date('2026-10-18T00:00:00Z')
			)
		);
		expect(url.host).toBe('acc.r2.cloudflarestorage.com');
		expect(url.pathname).toBe('/macfolio-files/resume/a%20b.pdf');
		expect(url.searchParams.get('X-Amz-Credential')).toBe('AK/20261018/auto/s3/aws4_request');
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;host');
		expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
		expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
	});
});
