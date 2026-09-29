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
	/** 올린 이미지·첨부 파일 */
	uploads: FakeUpload[];
	/** 사진 찾기: 켜진 서비스, 받은 검색어, Unsplash에 알린 사진 */
	stock: { providers: { unsplash: boolean; pexels: boolean }; searches: string[]; downloads: string[] };
}

export interface FakeUpload {
	id: string;
	name: string;
	type: string;
	image: boolean;
	data: Buffer;
}

/** multipart 요청에서 파일 하나를 꺼낸다 (가짜 서버용으로 단순하게) */
function readMultipartFile(body: Buffer) {
	const boundary = body.subarray(0, body.indexOf('\r\n')).toString('latin1');
	const headerEnd = body.indexOf('\r\n\r\n');
	const headers = body.subarray(0, headerEnd).toString('utf8');
	const end = body.indexOf(`\r\n${boundary}`, headerEnd);
	return {
		name: headers.match(/filename="([^"]*)"/)?.[1] ?? 'file',
		type: headers.match(/Content-Type: (\S+)/i)?.[1] ?? 'application/octet-stream',
		data: body.subarray(headerEnd + 4, end),
	};
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
		uploads: [],
		stock: { providers: { unsplash: true, pexels: false }, searches: [], downloads: [] },
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
	// 사진 찾기 결과의 그림 (1×1 PNG)
	await page.route('https://images.test/**', (route) =>
		route.fulfill({
			contentType: 'image/png',
			body: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				'base64'
			),
		})
	);
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
		// 파일: 관리자만 올리고, 누구나 받는다. 이미지는 PNG 첫 바이트로 알아본다
		if (path === '/files' && request.method() === 'POST') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const file = readMultipartFile(request.postDataBuffer()!);
			const image = file.data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
			const upload: FakeUpload = { id: `fakeupload${String(nextId++).padStart(6, '0')}`, ...file, image };
			if (image) upload.type = 'image/png';
			state.uploads.push(upload);
			const { data, ...view } = upload;
			return route.fulfill({
				status: 201,
				headers: cors(origin),
				json: { ...view, size: data.length, path: `/files/${upload.id}` },
			});
		}
		const filePath = path.match(/^\/files\/([\w-]+)$/);
		if (filePath) {
			const upload = state.uploads.find((item) => item.id === filePath[1]);
			if (!upload) return route.fulfill({ status: 404, headers: cors(origin) });
			return route.fulfill({
				status: 200,
				headers: { ...cors(origin), 'Content-Type': upload.type },
				body: upload.data,
			});
		}

		// 사진 찾기 (관리자만). 한 쪽에 두 장, 두 쪽까지
		if (path.startsWith('/images/')) {
			if (!state.signedIn) return route.fulfill(unauthorized);
			if (path === '/images/providers')
				return route.fulfill({ status: 200, headers: cors(origin), json: state.stock.providers });
			const download = path.match(/^\/images\/unsplash\/([\w-]+)\/download$/);
			if (download) {
				state.stock.downloads.push(download[1]);
				return route.fulfill({ status: 204, headers: cors(origin) });
			}
			const params = new URL(request.url()).searchParams;
			const provider = params.get('provider') as 'unsplash' | 'pexels';
			const q = params.get('q') ?? '';
			const page = Number(params.get('page') ?? 1);
			state.stock.searches.push(`${provider} ${q} ${page}`);
			const results = [1, 2].map((n) => {
				const id = `p${page}n${n}`;
				return {
					provider,
					id,
					thumb: `https://images.test/${id}-s.jpg`,
					url: `https://images.test/${id}.jpg`,
					width: 400,
					height: 300,
					alt: `${q} 사진 ${n}`,
					author: `사진가${n}`,
					authorUrl: `https://unsplash.com/@p${n}?utm_source=macfolio&utm_medium=referral`,
					pageUrl: `https://unsplash.com/photos/${id}`,
					color: '#88aacc',
				};
			});
			return route.fulfill({ status: 200, headers: cors(origin), json: { results, hasMore: page < 2 } });
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
