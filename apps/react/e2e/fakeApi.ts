import type { Page } from '@playwright/test';

export const FAKE_API = 'http://api.test';

export interface FakeApiState {
	signedIn: boolean;
	/** 서버에 저장된 메모 정리 내용 */
	organization: {
		folders: string[];
		posts: Record<string, string>;
		moves: { from: string; to: string }[];
		pins: Record<string, boolean>;
	};
	/** 받은 PUT 요청 수 */
	saves: number;
}

/**
 * 가짜 API (apps/api와 같은 경로). 실제 서버처럼
 * - /auth/github는 로그인을 마친 뒤 사이트로 돌려보내고(?admin=signed-in | denied), 그 뒤로 /auth/me는 관리자를 알려 준다
 * - /memo/organization은 누구나 읽고, 로그인했을 때만 바꿀 수 있다
 * 쿠키 대신 테스트 안의 변수로 로그인 상태를 기억한다. 새로고침해도 routes와 상태는 남는다.
 */
export async function fakeApi(
	page: Page,
	{
		admin = true,
		signedIn = false,
		organization,
	}: { admin?: boolean; signedIn?: boolean; organization?: Partial<FakeApiState['organization']> } = {}
): Promise<FakeApiState> {
	const state: FakeApiState = {
		signedIn,
		organization: { folders: [], posts: {}, moves: [], pins: {}, ...organization },
		saves: 0,
	};
	const cors = (origin: string) => ({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': 'GET, PUT, POST',
		'Access-Control-Allow-Headers': 'Content-Type',
	});
	await page.addInitScript((url) => {
		window.__MACFOLIO_API_URL__ = url;
	}, FAKE_API);
	await page.route('https://github.com/*.png*', (route) => route.fulfill({ status: 404 }));
	await page.route(`${FAKE_API}/**`, async (route) => {
		const request = route.request();
		const origin = (await request.headerValue('origin')) ?? 'http://localhost:4173';
		const path = new URL(request.url()).pathname;
		const unauthorized = { status: 401, headers: cors(origin), json: { statusCode: 401 } };
		// JSON을 보내는 PUT은 브라우저가 먼저 OPTIONS로 묻는다 (CORS)
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(origin) });

		if (path === '/auth/me') {
			return route.fulfill(
				state.signedIn ? { status: 200, headers: cors(origin), json: { login: 'hyeoniverse' } } : unauthorized
			);
		}
		if (path === '/auth/github') {
			state.signedIn = admin;
			const result = admin ? 'signed-in' : 'denied';
			return route.fulfill({ status: 302, headers: { Location: `http://localhost:4173/?admin=${result}` } });
		}
		if (path === '/auth/logout') {
			state.signedIn = false;
			return route.fulfill({ status: 204, headers: cors(origin) });
		}
		if (path === '/memo/organization') {
			if (request.method() === 'GET') {
				return route.fulfill({ status: 200, headers: cors(origin), json: { ...state.organization, updatedAt: null } });
			}
			if (!state.signedIn) return route.fulfill(unauthorized);
			state.organization = request.postDataJSON();
			state.saves += 1;
			return route.fulfill({ status: 200, headers: cors(origin), json: state.organization });
		}
		return route.fulfill({ status: 404 });
	});
	return state;
}
