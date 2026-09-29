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
	/** 글마다 댓글 (가짜 서버는 비밀번호를 그대로 들고 있다) */
	comments: Record<string, FakeComment[]>;
	/** 관리자가 쓰거나 고친 글, 지운 표시 */
	posts: FakePost[];
}

export interface FakePost {
	slug: string;
	title: string;
	date: string;
	category: string;
	summary: string;
	body: string;
	deleted: boolean;
}

export interface FakeComment {
	id: string;
	name: string;
	ipPrefix: string | null;
	isAdmin: boolean;
	body: string;
	createdAt: string;
	password?: string;
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
		comments: {},
		posts: [],
	};
	let nextId = 1;
	const cors = (origin: string) => ({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE',
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
		// 글: 누구나 읽고, 로그인했을 때만 쓰고 고치고 지운다
		const postPath = path.match(/^\/posts(?:\/([\w-]+))?$/);
		if (postPath) {
			const slug = postPath[1];
			if (request.method() === 'GET' && !slug)
				return route.fulfill({ status: 200, headers: cors(origin), json: state.posts });
			if (!state.signedIn) return route.fulfill(unauthorized);
			const upsert = (post: FakePost) => {
				state.posts = [...state.posts.filter((item) => item.slug !== post.slug), post];
				return post;
			};
			if (request.method() === 'DELETE' && slug) {
				const existing = state.posts.find((post) => post.slug === slug);
				upsert({
					...(existing ?? { slug, title: '', date: '2026-09-29', category: '기타', summary: '', body: '' }),
					deleted: true,
				});
				return route.fulfill({ status: 204, headers: cors(origin) });
			}
			const input = request.postDataJSON() as Omit<FakePost, 'slug' | 'deleted'>;
			if (!input.title?.trim())
				return route.fulfill({
					status: 400,
					headers: cors(origin),
					json: { statusCode: 400, message: ['제목을 입력해주세요.'] },
				});
			const post = upsert({ ...input, slug: slug ?? `${input.date}-fake${nextId++}`, deleted: false });
			return route.fulfill({ status: slug ? 200 : 201, headers: cors(origin), json: post });
		}

		// 댓글: 글마다 읽고 쓰고, 비밀번호(관리자는 없이)로 지운다
		const list = path.match(/^\/posts\/([\w-]+)\/comments$/);
		if (list) {
			const comments = (state.comments[list[1]] ??= []);
			const view = ({ password: _password, ...comment }: FakeComment) => comment;
			if (request.method() === 'GET')
				return route.fulfill({ status: 200, headers: cors(origin), json: comments.map(view) });
			const input = request.postDataJSON() as { name?: string; password?: string; body?: string };
			const comment: FakeComment = state.signedIn
				? {
						id: `c${nextId++}`,
						name: '김정현',
						ipPrefix: null,
						isAdmin: true,
						body: input.body ?? '',
						createdAt: new Date().toISOString(),
					}
				: {
						id: `c${nextId++}`,
						name: input.name ?? '',
						ipPrefix: '127.0',
						isAdmin: false,
						body: input.body ?? '',
						createdAt: new Date().toISOString(),
						password: input.password,
					};
			comments.push(comment);
			return route.fulfill({ status: 201, headers: cors(origin), json: view(comment) });
		}
		const one = path.match(/^\/comments\/(\w+)$/);
		if (one && request.method() === 'DELETE') {
			const { password } = (request.postDataJSON() ?? {}) as { password?: string };
			for (const comments of Object.values(state.comments)) {
				const index = comments.findIndex((comment) => comment.id === one[1]);
				if (index === -1) continue;
				if (!state.signedIn && comments[index].password !== password)
					return route.fulfill({ status: 403, headers: cors(origin), json: { statusCode: 403 } });
				comments.splice(index, 1);
				return route.fulfill({ status: 204, headers: cors(origin) });
			}
			return route.fulfill({ status: 404, headers: cors(origin), json: { statusCode: 404 } });
		}
		return route.fulfill({ status: 404 });
	});
	return state;
}
