import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	api,
	apiFetch,
	ApiError,
	messageOf,
	onUnauthorized,
	reasonsFrom,
	reasonsOf,
	SIGNED_OUT,
	TOO_MANY,
	UNREACHABLE,
} from './client';

const json = (body: unknown, status = 200) =>
	new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

const fetchWith = (response: Response | Error) =>
	vi.fn<typeof fetch>(async () => {
		if (response instanceof Error) throw response;
		return response;
	});

const API = 'https://api.test';

describe('apiFetch', () => {
	it('기본 주소 뒤에 경로를 붙이고 쿠키를 함께 보낸다', async () => {
		const fetchImpl = fetchWith(json({}));
		await apiFetch('/posts', { apiUrl: API, fetchImpl });
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe(`${API}/posts`);
		expect(init?.credentials).toBe('include');
		expect(init?.method).toBe('GET');
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it('json을 주면 JSON 머리말과 함께 보낸다', async () => {
		const fetchImpl = fetchWith(json({}));
		await apiFetch('/posts', { apiUrl: API, fetchImpl, method: 'POST', json: { title: 'a' } });
		const init = fetchImpl.mock.calls[0][1];
		expect(init?.body).toBe('{"title":"a"}');
		expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
	});

	it('body(FormData)는 그대로, timeout 0이면 signal 없이 보낸다', async () => {
		const fetchImpl = fetchWith(json({}));
		const form = new FormData();
		await apiFetch('/files', { apiUrl: API, fetchImpl, method: 'POST', body: form, timeout: 0 });
		const init = fetchImpl.mock.calls[0][1];
		expect(init?.body).toBe(form);
		expect(init?.signal).toBeUndefined();
		expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
	});

	it('주소가 없거나 서버에 닿지 못하면 ApiError(0)', async () => {
		await expect(apiFetch('/x', { apiUrl: '', fetchImpl: fetchWith(json({})) })).rejects.toMatchObject({
			status: 0,
			message: UNREACHABLE,
		});
		await expect(
			apiFetch('/x', { apiUrl: API, fetchImpl: fetchWith(new TypeError('Failed to fetch')) })
		).rejects.toMatchObject({
			status: 0,
			message: UNREACHABLE,
		});
	});

	it('401을 받으면 등록한 핸들러를 부른다', async () => {
		const handler = vi.fn();
		const off = onUnauthorized(handler);
		try {
			await apiFetch('/x', { apiUrl: API, fetchImpl: fetchWith(json({}, 401)) });
			expect(handler).toHaveBeenCalledTimes(1);
			await apiFetch('/x', { apiUrl: API, fetchImpl: fetchWith(json({}, 403)) });
			expect(handler).toHaveBeenCalledTimes(1);
		} finally {
			off();
		}
	});
});

describe('api', () => {
	afterEach(() => vi.restoreAllMocks());

	it('JSON을 돌려주고, 몸통이 비어 있으면 null', async () => {
		expect(await api('/x', { apiUrl: API, fetchImpl: fetchWith(json({ ok: 1 })) })).toEqual({ ok: 1 });
		expect(await api('/x', { apiUrl: API, fetchImpl: fetchWith(new Response(null, { status: 204 })) })).toBeNull();
	});

	it('실패하면 서버가 준 이유를 담은 ApiError', async () => {
		const error = await api('/x', {
			apiUrl: API,
			fetchImpl: fetchWith(json({ message: ['제목이 비었습니다', '날짜가 틀렸습니다'] }, 400)),
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(400);
		expect((error as ApiError).reasons).toEqual(['제목이 비었습니다', '날짜가 틀렸습니다']);
		expect((error as ApiError).message).toBe('제목이 비었습니다');
	});

	it('이유가 없으면 fallback', async () => {
		await expect(
			api('/x', {
				apiUrl: API,
				fetchImpl: fetchWith(new Response('oops', { status: 500 })),
				fallback: '저장하지 못했습니다.',
			})
		).rejects.toMatchObject({ status: 500, message: '저장하지 못했습니다.' });
	});
});

describe('reasonsOf', () => {
	it('서버가 적은 이유가 먼저, 없으면 401·429는 정해진 문구', async () => {
		expect(await reasonsOf(json({ message: 'Unauthorized' }, 401))).toEqual([SIGNED_OUT]);
		expect(await reasonsOf(json({ message: 'ThrottlerException: Too Many Requests' }, 429))).toEqual([TOO_MANY]);
		expect(await reasonsOf(json({ message: '오늘은 더 보낼 수 없습니다.' }, 429))).toEqual([
			'오늘은 더 보낼 수 없습니다.',
		]);
		expect(await reasonsOf(json({ message: 'x' }, 409))).toEqual(['x']);
		expect(await reasonsOf(json({ message: ['a', '', 3] }, 400))).toEqual(['a']);
		expect(await reasonsOf(new Response('', { status: 500 }), '안 됨')).toEqual(['안 됨']);
	});
});

describe('messageOf·reasonsFrom', () => {
	it('Error의 message, 아니면 fallback', () => {
		expect(messageOf(new Error('a'), 'b')).toBe('a');
		expect(messageOf('str', 'b')).toBe('b');
		expect(reasonsFrom(new ApiError(400, ['a', 'c']))).toEqual(['a', 'c']);
		expect(reasonsFrom(new Error('a'))).toEqual(['a']);
		expect(reasonsFrom(null, 'b')).toEqual(['b']);
	});
});
