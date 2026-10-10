// 서버(apps/api)에 보내는 모든 요청이 거치는 곳: 기본 주소, 쿠키, JSON, 시간 제한, 실패 문구, 401 알림.
// 앱의 *Api.ts는 경로와 응답 모양만 적는다. 바깥 서비스(날씨, 효과음)는 여기를 거치지 않는다
import { env } from '@/shared/config/env';

/** 서버에 닿지 못했을 때 (주소가 없거나, 서버가 꺼졌거나, 네트워크가 끊김) */
export const UNREACHABLE = '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.';
/** 401: 관리자 세션이 끝났다 */
export const SIGNED_OUT = '관리자 로그인이 끝났습니다. 다시 로그인해 주세요.';
/** 429: 요청 제한 */
export const TOO_MANY = '잠시 뒤에 다시 써 주세요.';
const DEFAULT_FAILURE = '요청을 처리하지 못했습니다.';
const DEFAULT_TIMEOUT = 15_000;

/** 실패한 요청. status 0은 서버에 닿지 못한 것 */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		/** 서버가 준 이유들 (검증 오류는 여러 줄). 첫 줄이 message */
		readonly reasons: string[]
	) {
		super(reasons[0]);
		this.name = 'ApiError';
	}
}

export interface ApiOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** JSON으로 보낼 몸통 */
	json?: unknown;
	/** 그대로 보낼 몸통 (FormData 등) */
	body?: BodyInit;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	/** 밀리초. 0이면 제한 없음 (큰 파일 올리기). signal을 주면 그것을 쓴다 */
	timeout?: number;
	/** 서버가 이유를 주지 않았을 때 보일 문구 */
	fallback?: string;
	/** 시험용 */
	apiUrl?: string;
	fetchImpl?: typeof fetch;
}

type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/** 어떤 요청이든 401을 받으면 부른다 (관리자 상태를 '로그아웃됨'으로 바꾸는 데 쓴다) */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
	unauthorizedHandlers.add(handler);
	return () => unauthorizedHandlers.delete(handler);
}

/** NestJS가 기본으로 붙이는 영어 문구 (서버가 이유를 따로 적지 않은 것) */
const isGenericMessage = (line: string) => /^(Unauthorized|Forbidden|Too Many Requests|ThrottlerException)/.test(line);

/**
 * 서버 오류 몸통({ message: string | string[] })에서 이유를 읽는다.
 * 서버가 적은 한국어 이유가 있으면 그것을, 없으면 상태별 문구(401·429)나 fallback
 */
export async function reasonsOf(response: Response, fallback = DEFAULT_FAILURE): Promise<string[]> {
	const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
	const message = body?.message;
	const reasons = (Array.isArray(message) ? message : [message]).filter(
		(line): line is string => typeof line === 'string' && line.length > 0 && !isGenericMessage(line)
	);
	if (reasons.length > 0) return reasons;
	if (response.status === 401) return [SIGNED_OUT];
	if (response.status === 429) return [TOO_MANY];
	return [fallback];
}

/**
 * 응답을 그대로 받는다 (상태 코드로 분기할 때). 쿠키를 함께 보내고, 서버에 닿지 못하면 ApiError(0).
 * 401이면 onUnauthorized 핸들러를 부른다
 */
export async function apiFetch(path: string, options: ApiOptions = {}): Promise<Response> {
	const { method = 'GET', json, body, headers = {}, signal, timeout = DEFAULT_TIMEOUT } = options;
	const apiUrl = options.apiUrl ?? env.apiUrl;
	const fetchImpl = options.fetchImpl ?? fetch;
	if (!apiUrl) throw new ApiError(0, [UNREACHABLE]);
	const init: RequestInit = { method, credentials: 'include', headers: { ...headers } };
	if (json !== undefined) {
		(init.headers as Record<string, string>)['Content-Type'] = 'application/json';
		init.body = JSON.stringify(json);
	} else if (body !== undefined) init.body = body;
	if (signal) init.signal = signal;
	else if (timeout > 0) init.signal = AbortSignal.timeout(timeout);
	let response: Response;
	try {
		response = await fetchImpl(`${apiUrl}${path}`, init);
	} catch {
		throw new ApiError(0, [UNREACHABLE]);
	}
	if (response.status === 401) unauthorizedHandlers.forEach((handler) => handler());
	return response;
}

/** JSON 응답. 2xx가 아니면 서버가 준 이유를 담은 ApiError. 몸통이 비어 있으면 null */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
	const response = await apiFetch(path, options);
	if (!response.ok) throw new ApiError(response.status, await reasonsOf(response, options.fallback));
	const text = await response.text();
	return (text ? JSON.parse(text) : null) as T;
}

/** 실패에서 보일 문구 (ApiError·Error면 그 message, 아니면 fallback) */
export const messageOf = (error: unknown, fallback = DEFAULT_FAILURE): string =>
	error instanceof Error && error.message ? error.message : fallback;

/** 실패에서 이유 목록 (ApiError면 서버가 준 줄들) */
export const reasonsFrom = (error: unknown, fallback = DEFAULT_FAILURE): string[] =>
	error instanceof ApiError ? error.reasons : [messageOf(error, fallback)];
