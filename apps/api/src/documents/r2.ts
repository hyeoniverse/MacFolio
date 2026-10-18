// R2(S3 호환 API)의 서명 주소. 관리자가 브라우저에서 파일을 R2에 바로 올리고(PUT), 서버는 확인(HEAD)·지우기(DELETE)에 쓴다.
// AWS 서명 버전 4의 "쿼리 문자열 서명"을 직접 만든다 (SDK 없이 node:crypto만)
import { createHash, createHmac } from 'node:crypto';

export interface R2Credentials {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
}

export interface PresignInput {
	method: 'GET' | 'HEAD' | 'PUT' | 'DELETE';
	host: string;
	/** 앞에 /가 붙은 경로 (인코딩 전) */
	path: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	/** 유효 시간 (초, 최대 7일) */
	expiresIn: number;
	now?: Date;
	/** 서명에 넣을 헤더 (이름은 소문자). PUT의 content-length를 넣으면 그 크기의 파일만 받는다 */
	headers?: Record<string, string>;
}

/** RFC 3986 인코딩 (S3는 '/'를 경로 구분자로 남긴다) */
const encode = (value: string, keepSlash = false) =>
	encodeURIComponent(value)
		.replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
		.replace(keepSlash ? /%2F/g : /$^/, '/');

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

/** 서명 주소 (https://host/path?X-Amz-...&X-Amz-Signature=...) */
export function presignUrl({
	method,
	host,
	path,
	region,
	accessKeyId,
	secretAccessKey,
	expiresIn,
	now = new Date(),
	headers = {},
}: PresignInput): string {
	const amzDate = now
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
	const day = amzDate.slice(0, 8);
	const scope = `${day}/${region}/s3/aws4_request`;
	const signed = { host, ...headers };
	const headerNames = Object.keys(signed).sort();
	const query: Record<string, string> = {
		'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
		'X-Amz-Credential': `${accessKeyId}/${scope}`,
		'X-Amz-Date': amzDate,
		'X-Amz-Expires': String(expiresIn),
		'X-Amz-SignedHeaders': headerNames.join(';'),
	};
	const canonicalQuery = Object.keys(query)
		.sort()
		.map((key) => `${encode(key)}=${encode(query[key])}`)
		.join('&');
	const canonicalPath = encode(path, true);
	const canonicalHeaders = headerNames
		.map((name) => `${name}:${String(signed[name as keyof typeof signed]).trim()}\n`)
		.join('');
	const canonicalRequest = [
		method,
		canonicalPath,
		canonicalQuery,
		canonicalHeaders,
		headerNames.join(';'),
		'UNSIGNED-PAYLOAD',
	].join('\n');
	const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
	const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), 's3'), 'aws4_request');
	const signature = createHmac('sha256', key).update(toSign).digest('hex');
	return `https://${host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** R2 버킷의 객체 하나에 대한 서명 주소 */
export const r2Url = (
	credentials: R2Credentials,
	method: PresignInput['method'],
	key: string,
	expiresIn: number,
	headers?: Record<string, string>,
	now?: Date
) =>
	presignUrl({
		method,
		host: `${credentials.accountId}.r2.cloudflarestorage.com`,
		path: `/${credentials.bucket}/${key}`,
		region: 'auto',
		accessKeyId: credentials.accessKeyId,
		secretAccessKey: credentials.secretAccessKey,
		expiresIn,
		headers,
		now,
	});
