import { createVerify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { budgetLevel, contentSha256, fetchBilling, signingString, signRequest, type OciCredentials } from './oci.js';

// Oracle 문서(Request Signatures)의 시험 값
const DOC_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDCFENGw33yGihy92pDjZQhl0C36rPJj+CvfSC8+q28hxA161QF
NUd13wuCTUcq0Qd2qsBe/2hFyc2DCJJg0h1L78+6Z4UMR7EOcpfdUE9Hf3m/hs+F
UR45uBJeDK1HSFHD8bHKD6kv8FPGfJTotc+2xjJwoYi+1hqp1fIekaxsyQIDAQAB
AoGBAJR8ZkCUvx5kzv+utdl7T5MnordT1TvoXXJGXK7ZZ+UuvMNUCdN2QPc4sBiA
QWvLw1cSKt5DsKZ8UETpYPy8pPYnnDEz2dDYiaew9+xEpubyeW2oH4Zx71wqBtOK
kqwrXa/pzdpiucRRjk6vE6YY7EBBs/g7uanVpGibOVAEsqH1AkEA7DkjVH28WDUg
f1nqvfn2Kj6CT7nIcE3jGJsZZ7zlZmBmHFDONMLUrXR/Zm3pR5m0tCmBqa5RK95u
412jt1dPIwJBANJT3v8pnkth48bQo/fKel6uEYyboRtA5/uHuHkZ6FQF7OUkGogc
mSJluOdc5t6hI1VsLn0QZEjQZMEOWr+wKSMCQQCC4kXJEsHAve77oP6HtG/IiEn7
kpyUXRNvFsDE0czpJJBvL/aRFUJxuRK91jhjC68sA7NsKMGg5OXb5I5Jj36xAkEA
gIT7aFOYBFwGgQAQkWNKLvySgKbAZRTeLBacpHMuQdl1DfdntvAyqpAZ0lY0RKmW
G6aFKaqQfOXKCyWoUiVknQJAXrlgySFci/2ueKlIE1QqIiLSZ8V8OlpFLRnb1pzI
7U1yQXnTAEFYM560yJlzUpOb1V4cScGd365tiSMvxLOvTA==
-----END RSA PRIVATE KEY-----`;
const DOC_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCFENGw33yGihy92pDjZQhl0C3
6rPJj+CvfSC8+q28hxA161QFNUd13wuCTUcq0Qd2qsBe/2hFyc2DCJJg0h1L78+6
Z4UMR7EOcpfdUE9Hf3m/hs+FUR45uBJeDK1HSFHD8bHKD6kv8FPGfJTotc+2xjJw
oYi+1hqp1fIekaxsyQIDAQAB
-----END PUBLIC KEY-----`;
const DATE = 'Thu, 05 Jan 2014 21:31:40 GMT';

const credentials: OciCredentials = {
	tenancy: 'ocid1.tenancy.oc1..aaaa',
	user: 'ocid1.user.oc1..bbbb',
	fingerprint: '20:3b:97:13:55:1c:5b:0d:d3:37:d8:50:4e:c5:3a:34',
	// 환경 변수처럼 줄바꿈을 \n으로 적은 키
	privateKey: DOC_PRIVATE_KEY.replace(/\n/g, '\\n'),
	region: 'ap-chuncheon-1',
};

describe('OCI 요청 서명', () => {
	it('GET: 문서의 서명 문자열과 같다', () => {
		const url =
			'https://iaas.us-phoenix-1.oraclecloud.com/20160918/instances?availabilityDomain=Pjwf%3A%20PHX-AD-1&compartmentId=ocid1.compartment.oc1..aaaaaaaam3we6vgnherjq5q2idnccdflvjsnog7mlr6rtdb25gilchfeyjxa&displayName=TeamXInstances&volumeId=ocid1.volume.oc1.phx.abyhqljrgvttnlx73nmrwfaux7kcvzfs3s66izvxf2h4lgvyndsdsnoiwr5q';
		const signed = signingString({ method: 'GET', url, date: DATE });
		expect(signed.names).toBe('date (request-target) host');
		expect(signed.text).toBe(
			[
				`date: ${DATE}`,
				'(request-target): get /20160918/instances?availabilityDomain=Pjwf%3A%20PHX-AD-1&compartmentId=ocid1.compartment.oc1..aaaaaaaam3we6vgnherjq5q2idnccdflvjsnog7mlr6rtdb25gilchfeyjxa&displayName=TeamXInstances&volumeId=ocid1.volume.oc1.phx.abyhqljrgvttnlx73nmrwfaux7kcvzfs3s66izvxf2h4lgvyndsdsnoiwr5q',
				'host: iaas.us-phoenix-1.oraclecloud.com',
			].join('\n')
		);
	});

	it('POST: 문서와 같은 머리글 순서, 본문의 SHA-256(base64)과 길이를 함께 서명한다', () => {
		const body = '{"a":1}';
		const signed = signingString({
			method: 'POST',
			url: 'https://iaas.us-phoenix-1.oraclecloud.com/20160918/volumeAttachments',
			date: DATE,
			body,
		});
		expect(signed.names).toBe('date (request-target) host content-length content-type x-content-sha256');
		expect(signed.text.split('\n')).toEqual([
			`date: ${DATE}`,
			'(request-target): post /20160918/volumeAttachments',
			'host: iaas.us-phoenix-1.oraclecloud.com',
			'content-length: 7',
			'content-type: application/json',
			`x-content-sha256: ${contentSha256(body)}`,
		]);
		expect(contentSha256('')).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
	});

	it('Authorization: keyId는 테넌시/사용자/지문, 서명은 문서의 공개 키로 확인된다', () => {
		const url = 'https://usage.ap-chuncheon-1.oci.oraclecloud.com/20190111/budgets?compartmentId=x';
		const headers = signRequest(credentials, { method: 'GET', url, date: DATE });
		expect(headers.date).toBe(DATE);
		const match = headers.authorization.match(
			/^Signature version="1",keyId="([^"]+)",algorithm="rsa-sha256",headers="([^"]+)",signature="([^"]+)"$/
		);
		expect(match?.[1]).toBe(`${credentials.tenancy}/${credentials.user}/${credentials.fingerprint}`);
		expect(match?.[2]).toBe('date (request-target) host');
		const ok = createVerify('RSA-SHA256')
			.update(signingString({ method: 'GET', url, date: DATE }).text)
			.verify(DOC_PUBLIC_KEY, match![3], 'base64');
		expect(ok).toBe(true);
	});
});

describe('요금과 예산', () => {
	it('예산을 읽고, 이번 달 1일부터 내일 0시까지의 요금을 더한다', async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(url), init: init! });
			if (String(url).includes('/budgets'))
				return Response.json([
					{
						displayName: '월 1달러',
						amount: 1,
						actualSpend: 0.25,
						forecastedSpend: 0.4,
						resetPeriod: 'MONTHLY',
						timeSpendComputed: '2026-10-10T00:00:00Z',
					},
				]);
			return Response.json({
				items: [
					{ computedAmount: 0.1, currency: 'USD' },
					{ computedAmount: 0.15, currency: 'USD' },
				],
			});
		}) as unknown as typeof fetch;
		const billing = await fetchBilling(credentials, new Date('2026-10-10T05:00:00Z'), fetchImpl);
		expect(billing).toMatchObject({
			monthToDate: 0.25,
			currency: 'USD',
			budgets: [{ displayName: '월 1달러', amount: 1, actualSpend: 0.25 }],
		});
		expect(calls[0].url).toBe(
			'https://usage.ap-chuncheon-1.oci.oraclecloud.com/20190111/budgets?compartmentId=ocid1.tenancy.oc1..aaaa'
		);
		expect(calls[1].url).toBe('https://usageapi.ap-chuncheon-1.oci.oraclecloud.com/20200107/usage');
		expect(JSON.parse(String(calls[1].init.body))).toMatchObject({
			tenantId: credentials.tenancy,
			timeUsageStarted: '2026-10-01T00:00:00.000Z',
			timeUsageEnded: '2026-10-11T00:00:00.000Z',
			granularity: 'DAILY',
			queryType: 'COST',
		});
		expect((calls[1].init.headers as Record<string, string>).authorization).toContain('x-content-sha256');
	});

	it('거절당하면 이유를 담아 실패한다', async () => {
		const fetchImpl = (async () =>
			Response.json({ code: 'NotAuthenticated', message: 'bad key' }, { status: 401 })) as unknown as typeof fetch;
		await expect(fetchBilling(credentials, new Date(), fetchImpl)).rejects.toThrow(/401 NotAuthenticated/);
	});

	it('예산의 80%를 넘으면 near, 다 쓰면 over', () => {
		const budget = {
			displayName: 'b',
			amount: 10,
			actualSpend: 0,
			forecastedSpend: null,
			resetPeriod: 'MONTHLY',
			timeSpendComputed: null,
		};
		expect(budgetLevel(budget)).toBe('ok');
		expect(budgetLevel({ ...budget, actualSpend: 8 })).toBe('near');
		expect(budgetLevel({ ...budget, actualSpend: 10 })).toBe('over');
	});
});
