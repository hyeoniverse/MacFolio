// Google Search Console API 부르기 (검색어). 서비스 계정의 JWT로 접근 토큰을 받는다 (googleapis 패키지는 크고 이 API 하나만 쓴다).
// 토큰: https://developers.google.com/identity/protocols/oauth2/service-account#httprest
// 검색어: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
import { createSign } from 'node:crypto';
import { normalizePem } from '../resources/oci.js';

export interface SearchConsoleCredentials {
	/** Search Console의 속성 (도메인 속성은 sc-domain:hyeoniverse.com, URL 접두어 속성은 https://macfolio.hyeoniverse.com/) */
	siteUrl: string;
	/** 서비스 계정 키(JSON)의 client_email */
	clientEmail: string;
	/** 서비스 계정 키(JSON)의 private_key. 환경 변수에는 줄바꿈을 \n으로 적어도 된다 */
	privateKey: string;
}

/** 검색어 하나: 그날 이 검색어로 이 페이지가 나온(노출) 수와 눌린(클릭) 수, 평균 순위 */
export interface SearchConsoleRow {
	day: string;
	query: string;
	page: string;
	clicks: number;
	impressions: number;
	position: number;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
/** 한 번에 받는 줄 수 (API의 상한) */
const ROW_LIMIT = 25_000;
/** 한 번 가져올 때 받는 줄의 상한 (작은 사이트라 넘지 않는다. 넘으면 노출 많은 것부터) */
const MAX_ROWS = 100_000;
/** 저장하는 검색어·주소 길이 */
const QUERY_MAX = 200;
const PAGE_MAX = 500;

export class SearchConsoleError extends Error {}

/** 접근 토큰을 달라고 보내는 서명한 JWT (RS256, 1시간) */
export function serviceAccountAssertion(credentials: SearchConsoleCredentials, now: Date): string {
	const iat = Math.floor(now.getTime() / 1000);
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
		iss: credentials.clientEmail,
		scope: SCOPE,
		aud: TOKEN_URL,
		iat,
		exp: iat + 3600,
	})}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(normalizePem(credentials.privateKey), 'base64url');
	return `${unsigned}.${signature}`;
}

async function send(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response> {
	let response: Response;
	try {
		response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000) });
	} catch {
		throw new SearchConsoleError('Google API에 연결할 수 없습니다.');
	}
	if (!response.ok) {
		const detail = (await response.json().catch(() => ({}))) as {
			error?: string | { message?: string; status?: string };
			error_description?: string;
		};
		const reason =
			typeof detail.error === 'string'
				? `${detail.error} ${detail.error_description ?? ''}`
				: `${detail.error?.status ?? ''} ${detail.error?.message ?? ''}`;
		throw new SearchConsoleError(`Google API가 거절했습니다 (${response.status}): ${reason.trim()}`.trim());
	}
	return response;
}

async function accessToken(credentials: SearchConsoleCredentials, now: Date, fetchImpl: typeof fetch) {
	const response = await send(fetchImpl, TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: serviceAccountAssertion(credentials, now),
		}).toString(),
	});
	const { access_token: token } = (await response.json()) as { access_token?: string };
	if (!token) throw new SearchConsoleError('Google API가 접근 토큰을 주지 않았습니다.');
	return token;
}

/**
 * 기간(날짜 포함)의 날짜·검색어·페이지별 클릭·노출·순위. 아직 확정되지 않은 최근 자료도 받는다 (다음에 다시 받아 덮는다).
 * Search Console은 드문 검색어(사람을 알아볼 수 있는 것)를 빼고 준다
 */
export async function fetchSearchQueries(
	credentials: SearchConsoleCredentials,
	range: { from: string; to: string },
	now: Date,
	fetchImpl: typeof fetch = fetch
): Promise<SearchConsoleRow[]> {
	const token = await accessToken(credentials, now, fetchImpl);
	const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(credentials.siteUrl)}/searchAnalytics/query`;
	const rows: SearchConsoleRow[] = [];
	for (let startRow = 0; startRow < MAX_ROWS; startRow += ROW_LIMIT) {
		const response = await send(fetchImpl, url, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify({
				startDate: range.from,
				endDate: range.to,
				dimensions: ['date', 'query', 'page'],
				dataState: 'all',
				rowLimit: ROW_LIMIT,
				startRow,
			}),
		});
		const page =
			(
				(await response.json()) as {
					rows?: { keys: string[]; clicks: number; impressions: number; position: number }[];
				}
			).rows ?? [];
		for (const { keys, clicks, impressions, position } of page)
			rows.push({
				day: keys[0],
				query: keys[1].slice(0, QUERY_MAX),
				page: keys[2].slice(0, PAGE_MAX),
				clicks: Math.round(clicks),
				impressions: Math.round(impressions),
				position,
			});
		if (page.length < ROW_LIMIT) break;
	}
	return rows;
}
