// Oracle Cloud API 부르기 (요금·예산). OCI의 요청 서명(HTTP Signature, rsa-sha256)을 직접 만든다 (SDK는 크고 이 두 API만 쓴다).
// 서명 방법: https://docs.oracle.com/en-us/iaas/Content/API/Concepts/signingrequests.htm
import { createHash, createSign } from 'node:crypto';

export interface OciCredentials {
	tenancy: string;
	user: string;
	fingerprint: string;
	/** PEM. 환경 변수에는 줄바꿈을 \n으로 적어도 된다 */
	privateKey: string;
	/** 홈 리전 (예: ap-chuncheon-1). 요금·예산 API는 홈 리전에서 부른다 */
	region: string;
}

/** 환경 변수의 \n을 줄바꿈으로 */
export const normalizePem = (pem: string) => pem.replace(/\\n/g, '\n').trim() + '\n';

export const contentSha256 = (body: string) => createHash('sha256').update(body).digest('base64');

export interface SignInput {
	method: string;
	url: string;
	date: string;
	body?: string;
	contentType?: string;
}

/** 서명할 머리글과 그 순서, 서명할 문자열 */
export function signingString({ method, url, date, body, contentType = 'application/json' }: SignInput) {
	const { host, pathname, search } = new URL(url);
	const lower = method.toLowerCase();
	const headers: [string, string][] = [
		['date', date],
		['(request-target)', `${lower} ${pathname}${search}`],
		['host', host],
	];
	if (lower === 'post' || lower === 'put' || lower === 'patch') {
		const payload = body ?? '';
		headers.push(
			['content-length', String(Buffer.byteLength(payload))],
			['content-type', contentType],
			['x-content-sha256', contentSha256(payload)]
		);
	}
	return {
		headers,
		names: headers.map(([name]) => name).join(' '),
		text: headers.map(([name, value]) => `${name}: ${value}`).join('\n'),
	};
}

/** 요청에 붙일 머리글 (Authorization 포함) */
export function signRequest(credentials: OciCredentials, input: SignInput): Record<string, string> {
	const { headers, names, text } = signingString(input);
	const signature = createSign('RSA-SHA256').update(text).sign(normalizePem(credentials.privateKey), 'base64');
	const keyId = `${credentials.tenancy}/${credentials.user}/${credentials.fingerprint}`;
	const result: Record<string, string> = {};
	for (const [name, value] of headers) if (name !== '(request-target)' && name !== 'host') result[name] = value;
	result.authorization = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${names}",signature="${signature}"`;
	return result;
}

export class OciError extends Error {}

async function call<T>(
	credentials: OciCredentials,
	method: 'GET' | 'POST',
	url: string,
	body: unknown,
	fetchImpl: typeof fetch
): Promise<T> {
	const payload = body === undefined ? undefined : JSON.stringify(body);
	const headers = signRequest(credentials, { method, url, date: new Date().toUTCString(), body: payload });
	let response: Response;
	try {
		response = await fetchImpl(url, { method, headers, body: payload, signal: AbortSignal.timeout(15_000) });
	} catch {
		throw new OciError('Oracle Cloud API에 연결할 수 없습니다.');
	}
	if (!response.ok) {
		const detail = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
		throw new OciError(
			`Oracle Cloud API가 거절했습니다 (${response.status} ${detail.code ?? ''}): ${detail.message ?? ''}`.trim()
		);
	}
	return (await response.json()) as T;
}

export interface Budget {
	displayName: string;
	amount: number;
	actualSpend: number | null;
	forecastedSpend: number | null;
	resetPeriod: string;
	timeSpendComputed: string | null;
}

export interface Billing {
	/** 이번 달 1일부터 오늘까지 요금 */
	monthToDate: number;
	currency: string | null;
	budgets: Budget[];
	updatedAt: string;
}

/** 이번 달(UTC) 요금과 예산들 */
export async function fetchBilling(
	credentials: OciCredentials,
	now: Date,
	fetchImpl: typeof fetch = fetch
): Promise<Billing> {
	const { region, tenancy } = credentials;
	const budgets = await call<Budget[]>(
		credentials,
		'GET',
		`https://usage.${region}.oci.oraclecloud.com/20190111/budgets?compartmentId=${encodeURIComponent(tenancy)}`,
		undefined,
		fetchImpl
	);
	// 일 단위 요청은 시각이 0시여야 한다: 이번 달 1일 0시부터 내일 0시까지
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
	const usage = await call<{ items: { computedAmount?: number | null; currency?: string | null }[] }>(
		credentials,
		'POST',
		`https://usageapi.${region}.oci.oraclecloud.com/20200107/usage`,
		{
			tenantId: tenancy,
			timeUsageStarted: monthStart.toISOString(),
			timeUsageEnded: tomorrow.toISOString(),
			granularity: 'DAILY',
			queryType: 'COST',
			isAggregateByTime: true,
		},
		fetchImpl
	);
	return {
		monthToDate: Math.round(usage.items.reduce((sum, item) => sum + (item.computedAmount ?? 0), 0) * 100) / 100,
		currency: usage.items.find((item) => item.currency)?.currency ?? null,
		budgets: budgets.map(({ displayName, amount, actualSpend, forecastedSpend, resetPeriod, timeSpendComputed }) => ({
			displayName,
			amount,
			actualSpend: actualSpend ?? null,
			forecastedSpend: forecastedSpend ?? null,
			resetPeriod,
			timeSpendComputed: timeSpendComputed ?? null,
		})),
		updatedAt: now.toISOString(),
	};
}

/** 예산을 얼마나 썼는지 (80%·100%를 넘으면 알린다) */
export function budgetLevel(budget: Budget): 'over' | 'near' | 'ok' {
	const spent = budget.actualSpend ?? 0;
	if (budget.amount <= 0) return 'ok';
	if (spent >= budget.amount) return 'over';
	return spent >= budget.amount * 0.8 ? 'near' : 'ok';
}
