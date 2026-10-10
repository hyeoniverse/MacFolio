import type { Page } from '@playwright/test';

export const FAKE_API = 'http://api.test';
/** 가짜 API가 알려 주는 로그인 시각 (한국 시각 2026년 10월 2일 오후 7:03) */
export const FAKE_SIGNED_IN_AT = '2026-10-02T10:03:00.000Z';
/** 가짜 API가 알려 주는 세션 만료 시각. 시험 중에 만료되지 않게 먼 뒤로 둔다 (한국 시각 2099년 10월 3일 오전 7:03) */
export const FAKE_EXPIRES_AT = '2099-10-02T22:03:00.000Z';

/** 서버에 저장된 연락 메일 (apps/api/src/contact의 ContactMailView) */
export interface FakeContactMail {
	id: string;
	name: string;
	email: string;
	subject: string;
	body: string;
	createdAt: string;
	replies: { id: string; body: string; createdAt: string }[];
}

export interface FakeApiState {
	signedIn: boolean;
	/** 관리자가 고친 사진 캡션 { 사진 주소: 캡션 } (GET·PUT /photos/captions) */
	photoCaptions: Record<string, string>;
	/** /health가 돌려줄 상태. blocked는 서버는 응답하지만 이 주소를 CORS로 허용하지 않는 경우 (PR 미리보기) */
	health: 'ok' | 'database' | 'down' | 'blocked';
	/** 서버에 저장된 메모 정리 내용 */
	organization: {
		folders: string[];
		posts: Record<string, string>;
		moves: { from: string; to: string }[];
		pins: Record<string, boolean>;
		locks?: Record<string, boolean>;
		order?: string[];
	};
	/** 받은 PUT 요청 수 */
	saves: number;
	/** 글마다 댓글 (가짜 서버는 비밀번호를 그대로 들고 있다) */
	comments: Record<string, FakeComment[]>;
	/** 보안 설정 (GET·PUT /security): 곳마다 사람 확인을 켰는지, 서버에 Turnstile 키가 있는지 */
	security: {
		contact: boolean;
		comment: boolean;
		message: boolean;
		available: boolean;
		turnstileSiteKey: string | null;
		updatedAt: string | null;
	};
	/** 받은 PUT /security 몸통 */
	securityUpdates: Record<string, boolean>[];
	/** 댓글·메시지를 쓸 때 받은 사람 확인 토큰 (켜져 있을 때) */
	humanTokens: string[];
	/** 글마다 좋아요 (수와 이 브라우저가 눌렀는지) */
	postLikes: Record<string, { count: number; liked: boolean }>;
	/** 이 브라우저(방문자 쿠키)의 이름. 서버처럼 첫 요청에 정해진다 */
	visitorName: string;
	/** 메시지 앱: 방문자가 남긴 피드백과 말풍선 (주인 안내에 단 답글은 threadId 'owner') */
	messageThreads: { id: string; title: string; createdAt: string; mine: boolean }[];
	messages: FakeMessage[];
	/** 관리자가 쓰거나 고친 글, 지운 표시 */
	posts: FakePost[];
	/** 올린 이미지·첨부 파일 */
	uploads: FakeUpload[];
	/** 관리자가 더한 배경화면 (이미지는 uploads에 있다) */
	wallpapers: FakeWallpaper[];
	/** 사진 찾기: 켜진 서비스, 받은 검색어, Unsplash에 알린 사진 */
	stock: { providers: { unsplash: boolean; pexels: boolean }; searches: string[]; downloads: string[] };
	/** 사이트가 보낸 분석 묶음 (POST /analytics/events의 본문) */
	analytics: { visitId: string; events: Record<string, unknown>[] }[];
	/** /analytics/today가 알려 줄 오늘 방문자 수 */
	todayVisitors: number;
	/** 관리자의 '활동 상태 보기'가 받는 요약과 실시간 (마지막으로 물은 기간도 남긴다) */
	analyticsSummary: Record<string, unknown>;
	analyticsLive: Record<string, unknown>[];
	/** 서버 자원 (GET /resources, 관리자만). 서버의 RESOURCE_MONITOR가 off면 mode만 */
	resources: Record<string, unknown>;
	analyticsQueries: string[];
	/** 메일 앱의 연락 메일 (#25): 서버가 보낼 수 있는지, 사람 확인 키, 받은 메일, 다음 보내기를 거절할 응답 */
	contact: {
		enabled: boolean;
		turnstileSiteKey: string | null;
		sent: Record<string, unknown>[];
		reject?: { status: number; message: string };
		/** 이 브라우저의 보낸 편지함 (GET /contact/mine) */
		mine: FakeContactMail[];
		/** 관리자의 받은 편지함 (GET /contact/inbox) */
		inbox: FakeContactMail[];
		/** 관리자가 보낸 답장 (POST /contact/:id/reply) */
		replies: { id: string; body: string }[];
	};
	/** /analytics/views가 알려 줄 항목마다 조회수 (앱 → 항목 → 수) */
	analyticsViews: Record<string, Record<string, number>>;
	/** GitHub 앱: 프로필, README, 보일 저장소, GitHub에 있는 저장소 (listed: 고를 수 있는 목록에 나온다) */
	github: {
		followers: number;
		readme: string;
		showcase: string[];
		repos: (FakeRepo & { listed: boolean })[];
		/** 받은 PUT /github/showcase 수 */
		saves: number;
		/** GET /github/activity가 줄 값. null이면 502 (GitHub에 닿지 못함) */
		activity: { contributions: { total: number; days: FakeDay[] } | null; events: FakeActivity[] } | null;
	};
}

export interface FakeDay {
	date: string;
	count: number;
	level: number;
}

export interface FakeActivity {
	id: string;
	kind: string;
	repo: string;
	createdAt: string;
	url: string;
	action: string | null;
	ref: string | null;
	refType: string | null;
	number: number | null;
	title: string | null;
	commits: number | null;
}

/** 2025-09-28(일)부터 2026-10-03(토)까지 53주. 날짜마다 정해진 기여 수 (같은 값이 나오게) */
export function fakeContributionDays(): FakeDay[] {
	const days: FakeDay[] = [];
	for (let time = Date.UTC(2025, 8, 28); time <= Date.UTC(2026, 9, 3); time += 86_400_000) {
		const index = days.length;
		const count = index % 7 === 0 ? 0 : (index * 7) % 13;
		days.push({
			date: new Date(time).toISOString().slice(0, 10),
			count,
			level: count === 0 ? 0 : Math.min(4, Math.ceil(count / 3)),
		});
	}
	return days;
}

export const fakeActivity = (over: Partial<FakeActivity>): FakeActivity => ({
	id: '1',
	kind: 'push',
	repo: 'hyeoniverse/alpha',
	createdAt: '2026-10-03T10:00:00Z',
	url: 'https://github.com/hyeoniverse/alpha/commits/main',
	action: null,
	ref: 'main',
	refType: null,
	number: null,
	title: '마지막 커밋',
	commits: 3,
	...over,
});

export interface FakeRepo {
	fullName: string;
	owner: string;
	name: string;
	description: string | null;
	url: string;
	homepage: string | null;
	language: string | null;
	stars: number;
	forks: number;
	fork: boolean;
}

export const fakeRepo = (fullName: string, rest: Partial<FakeRepo> = {}): FakeRepo => {
	const [owner, name] = fullName.split('/');
	return {
		fullName,
		owner,
		name,
		description: `${name} 저장소`,
		url: `https://github.com/${fullName}`,
		homepage: null,
		language: 'TypeScript',
		stars: 0,
		forks: 0,
		fork: false,
		...rest,
	};
};

/** 가짜 GitHub 프로필 README: 배너, 목록, 화면 모드마다 다른 그림, 배지 */
export const FAKE_README = `<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=soft&color=0:0A84FF,100:5E5CE6&text=Test%20Banner&desc=Live%20README" width="100%" alt="Test Banner">
</div>

## 소개

- **첫째** — 서버에서 받은 README
- **둘째** — 고치면 바로 보인다

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./profile/card-dark.svg">
    <img src="./profile/card-light.svg" width="49%" alt="Test Card">
  </picture>
</div>

## 연락

<div align="center">
  <a href="mailto:someone@example.com">
    <img src="https://img.shields.io/badge/Mail-0A84FF?style=for-the-badge&logo=gmail&logoColor=white" alt="Mail">
  </a>&nbsp;
  <a href="https://example.com/">
    <img src="https://img.shields.io/badge/Site-5E5CE6?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Site">
  </a>
</div>
`;

export interface FakeWallpaper {
	id: string;
	name: string;
	image: string;
	thumbnail: string;
}

/** multipart 본문을 칸마다 나눈다 (글자 칸은 value, 파일 칸은 filename·type·data) */
function readMultipart(body: Buffer) {
	const boundary = body.subarray(0, body.indexOf('\r\n')).toString('latin1');
	const parts: { field: string; filename?: string; type?: string; data: Buffer }[] = [];
	let start = 0;
	while ((start = body.indexOf(boundary, start)) !== -1) {
		const headerStart = start + boundary.length + 2;
		const headerEnd = body.indexOf('\r\n\r\n', headerStart);
		if (headerEnd === -1) break;
		const end = body.indexOf(`\r\n${boundary}`, headerEnd);
		const headers = body.subarray(headerStart, headerEnd).toString('utf8');
		parts.push({
			field: headers.match(/name="([^"]*)"/)?.[1] ?? '',
			filename: headers.match(/filename="([^"]*)"/)?.[1],
			type: headers.match(/Content-Type: (\S+)/i)?.[1],
			data: body.subarray(headerEnd + 4, end),
		});
		start = end;
	}
	return parts;
}

export interface FakeUpload {
	id: string;
	name: string;
	type: string;
	image: boolean;
	data: Buffer;
	createdAt?: string;
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

export interface FakeContent {
	title: string;
	date: string;
	category: string;
	summary: string;
	body: string;
}

/**
 * 가짜 서버의 글. title…body는 마지막으로 저장한 내용(임시 저장이 있으면 그것, 없으면 게시한 내용)이라
 * 테스트에서 '방금 저장된 것'을 바로 읽을 수 있다. published·draft는 실제 서버처럼 따로 둔다.
 */
export interface FakePost extends FakeContent {
	slug: string;
	deleted: boolean;
	/** 지운 때 (최근 삭제된 항목). 없는데 deleted면 영구히 지운 것 */
	deletedAt?: string | null;
	published?: FakeContent | null;
	draft?: FakeContent | null;
	revisions?: (FakeContent & { id: number; createdAt: string; createdBy: string })[];
}

export interface FakeComment {
	id: string;
	name: string;
	ipPrefix: string | null;
	isAdmin: boolean;
	body: string;
	createdAt: string;
	/** 이 브라우저가 쓴 댓글 */
	mine: boolean;
	/** 좋아요 수 (없으면 0) */
	likes?: number;
	/** 이 브라우저가 좋아요를 눌렀는지 (없으면 아니다) */
	liked?: boolean;
}

export interface FakeMessage {
	id: string;
	threadId: string;
	text: string;
	createdAt: string;
	authorId: string;
	nickname: string;
	fromOwner: boolean;
	mine: boolean;
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
		health: 'ok',
		organization: { folders: [], posts: {}, moves: [], pins: {}, ...organization },
		saves: 0,
		comments: {},
		postLikes: {},
		security: {
			contact: true,
			comment: false,
			message: false,
			available: true,
			turnstileSiteKey: '1x00000000000000000000AA',
			updatedAt: null,
		},
		securityUpdates: [],
		humanTokens: [],
		visitorName: '🦊 날쌘 여우',
		messageThreads: [],
		messages: [],
		posts: [],
		uploads: [],
		wallpapers: [],
		stock: { providers: { unsplash: true, pexels: false }, searches: [], downloads: [] },
		analytics: [],
		todayVisitors: 12,
		analyticsSummary: fakeAnalyticsSummary(),
		analyticsLive: fakeAnalyticsLive(),
		resources: { mode: 'off' },
		analyticsQueries: [],
		contact: { enabled: true, turnstileSiteKey: null, sent: [], mine: [], inbox: fakeInbox(), replies: [] },
		analyticsViews: { memo: { 'cra-to-vite': 42, 'post-editor': 7 } },
		photoCaptions: {},
		github: {
			followers: 42,
			readme: FAKE_README,
			showcase: ['hyeoniverse/alpha', 'test-org/gamma'],
			repos: [
				{ ...fakeRepo('hyeoniverse/alpha', { stars: 5, homepage: 'https://alpha.example.com/' }), listed: true },
				{ ...fakeRepo('hyeoniverse/beta', { language: 'JavaScript' }), listed: true },
				{ ...fakeRepo('test-org/gamma', { forks: 2 }), listed: true },
				{ ...fakeRepo('someone/Delta', { language: 'Python' }), listed: false },
			],
			saves: 0,
			activity: {
				contributions: { total: 1234, days: fakeContributionDays() },
				events: [
					fakeActivity({ id: '5' }),
					fakeActivity({ id: '4', createdAt: '2026-10-03T08:00:00Z', commits: 2 }),
					fakeActivity({
						id: '3',
						kind: 'pull',
						createdAt: '2026-10-02T09:00:00Z',
						url: 'https://github.com/hyeoniverse/alpha/pull/7',
						action: 'merged',
						ref: null,
						number: 7,
						title: '기능 더하기',
						commits: null,
					}),
					fakeActivity({
						id: '2',
						kind: 'create',
						repo: 'hyeoniverse/beta',
						createdAt: '2026-09-20T09:00:00Z',
						url: 'https://github.com/hyeoniverse/beta',
						refType: 'repository',
						ref: null,
						title: null,
						commits: null,
					}),
				],
			},
		},
	};
	let nextId = 1;
	const cors = (origin: string) => ({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': 'GET, PUT, POST, PATCH, DELETE',
		'Access-Control-Allow-Headers': 'Content-Type',
	});
	await page.addInitScript((url) => {
		window.__MACFOLIO_API_URL__ = url;
		window.__MACFOLIO_MESSAGES_STORE__ = 'server';
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

		// 트래픽 분석: sendBeacon은 text/plain(JSON 글자)으로 보낸다
		if (path === '/analytics/events' && request.method() === 'POST') {
			state.analytics.push(JSON.parse(request.postData() ?? '{}'));
			return route.fulfill({ status: 204, headers: cors(origin) });
		}
		if (path === '/contact' && request.method() === 'GET')
			return route.fulfill({
				status: 200,
				headers: cors(origin),
				json: { enabled: state.contact.enabled, turnstileSiteKey: state.contact.turnstileSiteKey },
			});
		if (path === '/contact' && request.method() === 'POST') {
			if (!state.contact.enabled)
				return route.fulfill({ status: 503, headers: cors(origin), json: { statusCode: 503 } });
			if (state.contact.reject)
				return route.fulfill({
					status: state.contact.reject.status,
					headers: cors(origin),
					json: { statusCode: state.contact.reject.status, message: state.contact.reject.message },
				});
			const input = JSON.parse(request.postData() ?? '{}');
			state.contact.sent.push(input);
			const mail: FakeContactMail = {
				id: `mail-${state.contact.sent.length}`,
				name: input.name,
				email: input.email,
				subject: input.subject,
				body: input.body,
				createdAt: '2026-10-07T05:00:00.000Z',
				replies: [],
			};
			state.contact.mine.unshift(mail);
			return route.fulfill({ status: 200, headers: cors(origin), json: { status: 'sent', mail } });
		}
		if (path === '/contact/mine')
			return route.fulfill({ status: 200, headers: cors(origin), json: state.contact.mine });
		if (path === '/contact/inbox') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			return route.fulfill({ status: 200, headers: cors(origin), json: state.contact.inbox });
		}
		const replyTo = /^\/contact\/([^/]+)\/reply$/.exec(path);
		if (replyTo && request.method() === 'POST') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const mail = state.contact.inbox.find((entry) => entry.id === replyTo[1]);
			if (!mail) return route.fulfill({ status: 404, headers: cors(origin), json: { statusCode: 404 } });
			const { body } = JSON.parse(request.postData() ?? '{}');
			state.contact.replies.push({ id: mail.id, body });
			mail.replies.push({ id: `reply-${state.contact.replies.length}`, body, createdAt: '2026-10-07T06:00:00.000Z' });
			return route.fulfill({ status: 200, headers: cors(origin), json: mail });
		}
		// 요약은 누구나: 방문자에게는 들어온 곳의 호스트·utm을 뺀 공개용 (서버와 같다)
		if (path === '/analytics/summary') {
			state.analyticsQueries.push(new URL(request.url()).search);
			const summary = state.analyticsSummary as { breakdown: Record<string, unknown> };
			const json = state.signedIn
				? summary
				: { ...summary, scope: 'public', breakdown: { ...summary.breakdown, referrer: [], source: [], campaign: [] } };
			return route.fulfill({ status: 200, headers: cors(origin), json });
		}
		if (path === '/resources') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			return route.fulfill({ status: 200, headers: cors(origin), json: state.resources });
		}
		if (path === '/analytics/live') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			state.analyticsQueries.push(new URL(request.url()).search);
			return route.fulfill({ status: 200, headers: cors(origin), json: state.analyticsLive });
		}
		if (path === '/analytics/views') {
			const app = new URL(request.url()).searchParams.get('app') ?? '';
			return route.fulfill({
				status: 200,
				headers: cors(origin),
				json: { app, views: state.analyticsViews[app] ?? {} },
			});
		}
		if (path === '/analytics/today')
			return route.fulfill({
				status: 200,
				headers: cors(origin),
				json: { day: '2026-10-07', visitors: state.todayVisitors },
			});
		// 서버 상태 (메뉴 막대의 Wi-Fi 자리): ok, DB가 안 됨(503), 꺼짐(연결 실패)
		if (path === '/health') {
			if (state.health === 'down') return route.abort('connectionrefused');
			// 다른 주소만 허용한다고 답한다: 브라우저가 응답을 읽지 못하게 막고, 응답을 읽지 않는 no-cors 요청만 닿는다.
			// (CORS 헤더를 아예 빼면 Playwright가 알아서 붙여 줘서 막히지 않는다)
			if (state.health === 'blocked')
				return route.fulfill({
					status: 200,
					headers: { 'Access-Control-Allow-Origin': 'https://macfolio.hyeoniverse.com' },
					json: { status: 'ok', database: 'up' },
				});
			if (state.health === 'database')
				return route.fulfill({
					status: 503,
					headers: cors(origin),
					json: { statusCode: 503, message: 'DB에 연결할 수 없습니다.' },
				});
			return route.fulfill({ status: 200, headers: cors(origin), json: { status: 'ok', database: 'up' } });
		}
		if (path === '/auth/me') {
			return route.fulfill(
				state.signedIn
					? {
							status: 200,
							headers: cors(origin),
							json: { login: 'hyeoniverse', signedInAt: FAKE_SIGNED_IN_AT, expiresAt: FAKE_EXPIRES_AT },
						}
					: unauthorized
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
			const upload: FakeUpload = {
				id: `fakeupload${String(nextId++).padStart(6, '0')}`,
				...file,
				image,
				createdAt: new Date().toISOString(),
			};
			if (image) upload.type = 'image/png';
			state.uploads.push(upload);
			const { data, ...view } = upload;
			return route.fulfill({
				status: 201,
				headers: cors(origin),
				json: { ...view, size: data.length, path: `/files/${upload.id}` },
			});
		}
		// 파일 목록과 지우기 (관리자): 실제 서버처럼 지금 글·예전 버전·배경화면에서 쓰는지 알려 주고, 쓰는 파일은 지우지 않는다
		const fileUsage = (id: string) => {
			const pointsTo = (text?: string | null) => Boolean(text?.includes(`/files/${id}`));
			const posts = state.posts
				.filter((post) =>
					[
						post.summary,
						post.body,
						post.published?.body,
						post.published?.summary,
						post.draft?.body,
						post.draft?.summary,
					].some(pointsTo)
				)
				.map((post) => post.slug)
				.sort();
			const revisions = state.posts
				.filter(
					(post) => !posts.includes(post.slug) && (post.revisions ?? []).some((revision) => pointsTo(revision.body))
				)
				.map((post) => post.slug)
				.sort();
			const wallpaper = state.wallpapers.some((item) => pointsTo(item.image) || pointsTo(item.thumbnail));
			return { posts, revisions, wallpaper };
		};
		if (path === '/files' && request.method() === 'GET') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			return route.fulfill({
				status: 200,
				headers: cors(origin),
				json: [...state.uploads].reverse().map(({ data, ...upload }) => ({
					...upload,
					size: data.length,
					path: `/files/${upload.id}`,
					createdAt: upload.createdAt ?? '2026-10-01T00:00:00.000Z',
					createdBy: 'hyeoniverse',
					usedBy: fileUsage(upload.id),
				})),
			});
		}
		const deleteFile = request.method() === 'DELETE' && path.match(/^\/files\/([\w-]+)$/);
		if (deleteFile) {
			if (!state.signedIn) return route.fulfill(unauthorized);
			if (!state.uploads.some((item) => item.id === deleteFile[1]))
				return route.fulfill({ status: 404, headers: cors(origin) });
			const usage = fileUsage(deleteFile[1]);
			if (usage.wallpaper || usage.posts.length > 0)
				return route.fulfill({
					status: 409,
					headers: cors(origin),
					json: { statusCode: 409, message: '쓰는 파일입니다.' },
				});
			state.uploads = state.uploads.filter((item) => item.id !== deleteFile[1]);
			return route.fulfill({ status: 204, headers: cors(origin) });
		}
		// GitHub 앱: 누구나 프로필을 받고, 관리자만 보일 저장소를 고른다
		const cards = (names: string[]) =>
			names
				.map((name) => state.github.repos.find((repo) => repo.fullName.toLowerCase() === name.toLowerCase()))
				.filter((repo) => repo !== undefined)
				.map(({ listed: _listed, ...repo }) => repo);
		if (path === '/github/profile') {
			return route.fulfill({
				headers: cors(origin),
				json: {
					profile: {
						login: 'hyeoniverse',
						name: 'Test Name',
						avatarUrl: 'https://avatars.githubusercontent.com/u/1',
						bio: '서버에서 받은 소개',
						location: 'Test City',
						website: 'https://example.com/',
						url: 'https://github.com/hyeoniverse',
						followers: state.github.followers,
						following: 8,
						publicRepos: 30,
					},
					readme: state.github.readme,
					readmeBaseUrl: 'https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/HEAD/',
					repos: cards(state.github.showcase),
					fetchedAt: new Date().toISOString(),
				},
			});
		}
		if (path === '/github/activity') {
			if (!state.github.activity)
				return route.fulfill({ status: 502, headers: cors(origin), json: { message: 'GitHub에 연결할 수 없습니다.' } });
			return route.fulfill({
				headers: cors(origin),
				json: { ...state.github.activity, fetchedAt: new Date().toISOString() },
			});
		}
		if (path === '/github/candidates') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const listed = state.github.repos.filter((repo) => repo.listed).map((repo) => repo.fullName);
			const extra = state.github.showcase.filter(
				(name) => !listed.some((other) => other.toLowerCase() === name.toLowerCase())
			);
			return route.fulfill({
				headers: cors(origin),
				json: { selected: state.github.showcase, repos: cards([...extra, ...listed]) },
			});
		}
		const repoPath = path.match(/^\/github\/repos\/([^/]+)\/([^/]+)$/);
		if (repoPath) {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const [found] = cards([`${decodeURIComponent(repoPath[1])}/${decodeURIComponent(repoPath[2])}`]);
			return found
				? route.fulfill({ headers: cors(origin), json: found })
				: route.fulfill({
						status: 404,
						headers: cors(origin),
						json: { statusCode: 404, message: '공개 저장소를 찾을 수 없습니다.' },
					});
		}
		// 사진 캡션: 누구나 읽고, 관리자만 고친다. 비우면 원래 캡션으로
		if (path === '/photos/captions' && request.method() === 'GET')
			return route.fulfill({ headers: cors(origin), json: state.photoCaptions });
		if (path === '/photos/captions' && request.method() === 'PUT') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const { src, caption } = request.postDataJSON() as { src: string; caption: string };
			const cleaned = caption.trim();
			const next = { ...state.photoCaptions };
			if (cleaned) next[src] = cleaned;
			else delete next[src];
			state.photoCaptions = next;
			return route.fulfill({ headers: cors(origin), json: next });
		}
		if (path === '/github/showcase' && request.method() === 'PUT') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const repos = (request.postDataJSON()?.repos ?? []) as string[];
			if (repos.length > 6)
				return route.fulfill({
					status: 400,
					headers: cors(origin),
					json: { statusCode: 400, message: ['저장소는 6개까지 고를 수 있습니다.'] },
				});
			const saved = cards(repos).map((repo) => repo.fullName);
			if (saved.length !== repos.length)
				return route.fulfill({
					status: 404,
					headers: cors(origin),
					json: { statusCode: 404, message: '공개 저장소를 찾을 수 없습니다.' },
				});
			state.github.showcase = saved;
			state.github.saves += 1;
			return route.fulfill({ headers: cors(origin), json: { repos: saved } });
		}
		// 배경화면: 누구나 목록을 보고, 관리자만 더하고 지운다
		if (path === '/wallpapers' && request.method() === 'GET') {
			return route.fulfill({ status: 200, headers: cors(origin), json: state.wallpapers });
		}
		if (path === '/wallpapers' && request.method() === 'POST') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const parts = readMultipart(request.postDataBuffer()!);
			const field = (name: string) => parts.find((part) => part.field === name);
			const image = field('image');
			const thumbnail = field('thumbnail');
			if (!image || !thumbnail) {
				return route.fulfill({ status: 400, headers: cors(origin), json: { statusCode: 400 } });
			}
			const save = (part: typeof image) => {
				const upload: FakeUpload = {
					id: `fakeupload${String(nextId++).padStart(6, '0')}`,
					name: part.filename ?? 'file',
					type: part.type ?? 'image/jpeg',
					image: true,
					data: Buffer.from(part.data),
				};
				state.uploads.push(upload);
				return `/files/${upload.id}`;
			};
			const wallpaper: FakeWallpaper = {
				id: `fakewall${String(nextId++).padStart(8, '0')}`,
				name: field('name')?.data.toString('utf8') || 'wallpaper',
				image: save(image),
				thumbnail: save(thumbnail),
			};
			state.wallpapers.push(wallpaper);
			return route.fulfill({ status: 201, headers: cors(origin), json: wallpaper });
		}
		const wallpaperPath = path.match(/^\/wallpapers\/([\w-]+)$/);
		if (wallpaperPath && request.method() === 'PATCH') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const wallpaper = state.wallpapers.find((w) => w.id === wallpaperPath[1]);
			if (!wallpaper) return route.fulfill({ status: 404, headers: cors(origin) });
			const name = String(request.postDataJSON()?.name ?? '').trim();
			if (!name) return route.fulfill({ status: 400, headers: cors(origin), json: { statusCode: 400 } });
			wallpaper.name = name;
			return route.fulfill({ status: 200, headers: cors(origin), json: wallpaper });
		}
		if (wallpaperPath && request.method() === 'DELETE') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const before = state.wallpapers.length;
			state.wallpapers = state.wallpapers.filter((w) => w.id !== wallpaperPath[1]);
			return route.fulfill({ status: before === state.wallpapers.length ? 404 : 204, headers: cors(origin) });
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

		// 보안 설정: 누구나 읽고 관리자만 바꾼다
		if (path === '/security') {
			if (request.method() === 'GET')
				return route.fulfill({ status: 200, headers: cors(origin), json: state.security });
			if (!state.signedIn) return route.fulfill({ status: 401, headers: cors(origin), json: { statusCode: 401 } });
			const patch = request.postDataJSON() as Record<string, boolean>;
			state.securityUpdates.push(patch);
			state.security = { ...state.security, ...patch, updatedAt: new Date().toISOString() };
			return route.fulfill({ status: 200, headers: cors(origin), json: state.security });
		}
		/** 사람 확인을 켠 곳에 방문자가 쓰면 토큰이 있어야 한다 (서버처럼 관리자는 건너뛴다). 없으면 400 응답 */
		const needsHuman = (check: 'comment' | 'message') => {
			if (!state.security[check] || !state.security.available || state.signedIn) return null;
			const token = (request.postDataJSON() as { turnstileToken?: string }).turnstileToken;
			if (token) {
				state.humanTokens.push(token);
				return null;
			}
			return route.fulfill({
				status: 400,
				headers: cors(origin),
				json: { statusCode: 400, message: '사람인지 확인하지 못했습니다. 다시 시도해 주세요.' },
			});
		};

		// 좋아요: 글·댓글마다 이 브라우저가 한 번. /posts/stats는 글마다 댓글 수·좋아요 수 (인기글)
		const reply = (body: unknown) => route.fulfill({ status: 200, headers: cors(origin), json: body });
		if (path === '/posts/stats' && request.method() === 'GET') {
			const stats: Record<string, { comments: number; likes: number }> = {};
			for (const [slug, comments] of Object.entries(state.comments))
				if (comments.length > 0) stats[slug] = { comments: comments.length, likes: 0 };
			for (const [slug, { count }] of Object.entries(state.postLikes))
				if (count > 0) stats[slug] = { comments: stats[slug]?.comments ?? 0, likes: count };
			return reply(stats);
		}
		const postLike = path.match(/^\/posts\/([\w-]+)\/(likes|like)$/);
		if (postLike) {
			const likes = (state.postLikes[postLike[1]] ??= { count: 0, liked: false });
			const method = request.method();
			if (postLike[2] === 'like' && (method === 'PUT' || method === 'DELETE')) {
				const liked = method === 'PUT';
				if (likes.liked !== liked) likes.count += liked ? 1 : -1;
				likes.liked = liked;
			}
			return reply({ count: likes.count, liked: likes.liked });
		}
		const commentLike = path.match(/^\/comments\/(\w+)\/like$/);
		if (commentLike) {
			const comment = Object.values(state.comments)
				.flat()
				.find((item) => item.id === commentLike[1]);
			if (!comment) return route.fulfill({ status: 404, headers: cors(origin), json: { statusCode: 404 } });
			const liked = request.method() === 'PUT';
			if (!!comment.liked !== liked) comment.likes = (comment.likes ?? 0) + (liked ? 1 : -1);
			comment.liked = liked;
			return reply({ count: comment.likes ?? 0, liked });
		}

		// 글: 누구나 게시한 글을 읽고, 로그인했을 때만 임시 저장·게시·버리기·지우기 (apps/api와 같은 규칙)
		const postPath = path.match(
			/^\/posts(?:\/([\w-]+))?(?:\/(draft|publish|revisions|restore|permanent)(?:\/(\d+))?)?$/
		);
		if (postPath) {
			const [, slug, action, revisionId] = postPath;
			const method = request.method();
			const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
			const find = (key: string) => state.posts.find((post) => post.slug === key);
			const pick = ({ title, date, category, summary, body }: FakeContent): FakeContent => ({
				title,
				date,
				category,
				summary,
				body,
			});
			const adminView = (post: FakePost) => ({
				slug: post.slug,
				published: post.published ?? null,
				publishedAt: post.published ? '2026-09-29T00:00:00.000Z' : null,
				draft: post.draft ?? null,
				draftUpdatedAt: post.draft ? '2026-09-29T00:00:00.000Z' : null,
				deleted: post.deleted,
				deletedAt: post.deletedAt ?? null,
				revisions: post.revisions?.length ?? 0,
			});
			const ok = (json: unknown, status = 200) => route.fulfill({ status, headers: cors(origin), json });

			if (!slug && method === 'GET') {
				// 방문자: 게시한 글 중 날짜가 된 것, 지운·예약 글은 가리는 표시로
				const visible = state.posts
					.filter((post) => post.deleted || post.published)
					.map((post) =>
						post.deleted || post.published!.date > today
							? { slug: post.slug, title: '', date: '', category: '', summary: '', body: '', deleted: true }
							: { slug: post.slug, ...pick(post.published!), deleted: false }
					);
				return ok(visible);
			}
			if (!state.signedIn) return route.fulfill(unauthorized);
			if (slug === 'admin' && !action && method === 'GET') return ok(state.posts.map(adminView));

			const upsert = (post: FakePost) => {
				state.posts = [...state.posts.filter((item) => item.slug !== post.slug), post];
				return post;
			};
			if (method === 'DELETE' && slug && !action) {
				// 최근 삭제된 항목으로: 내용·임시 저장은 그대로 (되살릴 수 있게)
				const existing = find(slug);
				upsert({
					...(existing ?? { slug, title: '', date: '2026-09-29', category: '기타', summary: '', body: '' }),
					deleted: true,
					deletedAt: new Date().toISOString(),
				});
				return route.fulfill({ status: 204, headers: cors(origin) });
			}
			if (action === 'restore' || action === 'permanent') {
				const existing = find(slug!);
				if (!existing?.deleted || !existing.deletedAt)
					return route.fulfill({ status: 404, headers: cors(origin), json: { statusCode: 404 } });
				if (action === 'permanent') {
					upsert({ ...existing, published: null, draft: null, revisions: [], deletedAt: null });
					return route.fulfill({ status: 204, headers: cors(origin) });
				}
				// 서버에 내용이 없던 저장소 글이면 표시를 지운다 (파일이 다시 보인다)
				if (!existing.published && !existing.draft) {
					state.posts = state.posts.filter((item) => item.slug !== slug);
					return route.fulfill({ status: 200, headers: cors(origin), body: '' });
				}
				return ok(adminView(upsert({ ...existing, deleted: false, deletedAt: null })));
			}
			if (action === 'revisions') {
				const revisions = [...(find(slug!)?.revisions ?? [])].reverse();
				if (!revisionId)
					return ok(
						revisions.map(({ id, title, date, createdAt, createdBy }) => ({ id, title, date, createdAt, createdBy }))
					);
				const revision = revisions.find((item) => item.id === Number(revisionId));
				return revision
					? ok(revision)
					: route.fulfill({ status: 404, headers: cors(origin), json: { statusCode: 404 } });
			}
			if (action === 'draft' && method === 'DELETE') {
				const existing = find(slug!);
				if (!existing)
					return route.fulfill({
						status: 404,
						headers: cors(origin),
						json: { statusCode: 404, message: '글이 없습니다.' },
					});
				if (!existing.published) {
					state.posts = state.posts.filter((item) => item.slug !== slug);
					return route.fulfill({ status: 200, headers: cors(origin), body: '' });
				}
				return ok(adminView(upsert({ ...existing, ...existing.published, draft: null })));
			}

			const input = pick(request.postDataJSON() as FakeContent);
			if (!input.title?.trim())
				return route.fulfill({
					status: 400,
					headers: cors(origin),
					json: { statusCode: 400, message: ['제목을 입력해주세요.'] },
				});
			if (action === 'publish') {
				const existing = find(slug!);
				const revisions = [
					...(existing?.revisions ?? []),
					{
						...input,
						id: nextId++,
						createdAt: new Date(Date.now() + nextId * 60_000).toISOString(),
						createdBy: 'hyeoniverse',
					},
				];
				return ok(
					adminView(upsert({ slug: slug!, ...input, deleted: false, published: input, draft: null, revisions }))
				);
			}
			// 임시 저장: 새 글(POST /posts)이면 주소를 만든다
			const key = slug ?? `${input.date}-fake${nextId++}`;
			const existing = find(key);
			const post = upsert({
				slug: key,
				...input,
				deleted: false,
				published: existing?.published ?? null,
				draft: input,
				revisions: existing?.revisions ?? [],
			});
			return ok(adminView(post), slug ? 200 : 201);
		}

		const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors(origin), json: body });
		const forbidden = () => json({ statusCode: 403 }, 403);
		const notFound = () => json({ statusCode: 404 }, 404);
		/** 서버처럼: 관리자는 김정현, 방문자는 쿠키로 정한 이름 */
		const author = () =>
			state.signedIn
				? { name: '김정현', isAdmin: true, ipPrefix: null }
				: { name: state.visitorName, isAdmin: false, ipPrefix: '127.0' };

		if (path === '/visitor') return json({ name: state.visitorName });

		// 댓글: 글마다 읽고 쓰고, 이 브라우저에서 쓴 것(관리자는 무엇이든)을 지운다
		const list = path.match(/^\/posts\/([\w-]+)\/comments$/);
		if (list) {
			const comments = (state.comments[list[1]] ??= []);
			if (request.method() === 'GET') return json(comments.map((comment) => ({ likes: 0, liked: false, ...comment })));
			const rejected = needsHuman('comment');
			if (rejected) return rejected;
			const input = request.postDataJSON() as { body?: string };
			const comment: FakeComment = {
				id: `c${nextId++}`,
				...author(),
				body: input.body ?? '',
				createdAt: new Date().toISOString(),
				mine: true,
				likes: 0,
				liked: false,
			};
			comments.push(comment);
			return json(comment, 201);
		}
		const one = path.match(/^\/comments\/(\w+)$/);
		if (one && request.method() === 'DELETE') {
			for (const comments of Object.values(state.comments)) {
				const index = comments.findIndex((comment) => comment.id === one[1]);
				if (index === -1) continue;
				if (!state.signedIn && !comments[index].mine) return forbidden();
				comments.splice(index, 1);
				return route.fulfill({ status: 204, headers: cors(origin) });
			}
			return notFound();
		}

		// 메시지 앱: 주인 안내(owner)와 피드백. 안내 글은 프론트엔드에 있고, 여기에는 답글만 있다
		const newMessage = (threadId: string, text: string): FakeMessage => {
			const { name, isAdmin } = author();
			return {
				id: `m${nextId++}`,
				threadId,
				text,
				createdAt: new Date().toISOString(),
				authorId: isAdmin ? 'owner' : 'me',
				nickname: name,
				fromOwner: isAdmin,
				mine: true,
			};
		};
		const threadView = (thread: FakeApiState['messageThreads'][number]) => {
			const own = state.messages.filter((m) => m.threadId === thread.id);
			const last = own.at(-1);
			return {
				...thread,
				summary: own[0]?.text,
				...(last ? { lastMessage: { text: last.text, createdAt: last.createdAt } } : {}),
			};
		};
		if (path === '/messages/threads') {
			if (request.method() === 'GET') {
				const pinned = threadView({ id: 'owner', title: '김정현', createdAt: '2026-09-28T00:00:00.000Z', mine: false });
				return json([{ ...pinned, summary: undefined, pinned: true }, ...state.messageThreads.map(threadView)]);
			}
			const rejected = needsHuman('message');
			if (rejected) return rejected;
			const { body } = request.postDataJSON() as { body: string };
			const thread = { id: `t${nextId++}`, title: author().name, createdAt: new Date().toISOString(), mine: true };
			const message = newMessage(thread.id, body.trim());
			state.messageThreads.push(thread);
			state.messages.push(message);
			return json({ thread: threadView(thread), message }, 201);
		}
		const thread = path.match(/^\/messages\/threads\/(\w+)$/);
		if (thread) {
			if (thread[1] !== 'owner' && !state.messageThreads.some((t) => t.id === thread[1])) return notFound();
			if (request.method() === 'GET') return json(state.messages.filter((m) => m.threadId === thread[1]));
			const rejected = needsHuman('message');
			if (rejected) return rejected;
			const message = newMessage(thread[1], (request.postDataJSON() as { body: string }).body.trim());
			state.messages.push(message);
			return json(message, 201);
		}
		const message = path.match(/^\/messages\/(\w+)$/);
		if (message && request.method() === 'DELETE') {
			const index = state.messages.findIndex((m) => m.id === message[1]);
			if (index === -1) return notFound();
			if (!state.signedIn && !state.messages[index].mine) return forbidden();
			state.messages.splice(index, 1);
			return route.fulfill({ status: 204, headers: cors(origin) });
		}
		return route.fulfill({ status: 404 });
	});
	return state;
}

/** 활동 상태 보기의 요약 (7일). 숫자는 API(apps/api/src/analytics)의 응답 모양 그대로 */
function fakeAnalyticsSummary() {
	const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
	const visits = [150, 180, 160, 210, 190, 170, 224];
	return {
		scope: 'admin',
		from: days[0],
		to: days.at(-1),
		days: days.map((day, index) => ({ day, visits: visits[index], visitors: Math.round(visits[index] * 0.7) })),
		totals: { visits: 1284, visitors: 902, appOpens: 3410, avgDurationSec: 161 },
		previous: { visits: 1146, visitors: 950, appOpens: 3410, avgDurationSec: 150 },
		breakdown: {
			referrerGroup: [
				{ key: '링크', value: 412 },
				{ key: '직접', value: 301 },
				{ key: '소셜', value: 188 },
				{ key: '검색', value: 90 },
			],
			referrer: [
				{ key: 'github.com', value: 412 },
				{ key: '', value: 301 },
				{ key: 'www.linkedin.com', value: 188 },
				{ key: 'www.google.com', value: 90 },
			],
			source: [{ key: 'resume', value: 40 }],
			campaign: [{ key: 'kakao-2026', value: 25 }],
			app: [
				{ key: 'memo', value: 900 },
				{ key: 'safari', value: 700 },
				{ key: 'music', value: 120 },
			],
			item: [{ key: 'memo/cra-to-vite', value: 210 }],
			link: [{ key: 'github.com/hyeoniverse', value: 77 }],
			country: [
				{ key: 'KR', value: 1000 },
				{ key: 'US', value: 200 },
			],
			device: [
				{ key: 'desktop', value: 800 },
				{ key: 'mobile', value: 484 },
			],
			browser: [{ key: 'Chrome', value: 900 }],
			os: [{ key: 'macOS', value: 700 }],
			language: [{ key: 'ko-KR', value: 1100 }],
		},
	};
}

/** 활동 상태 보기의 실시간: 방문 하나와 그 흐름 */
function fakeAnalyticsLive() {
	return [
		{
			visitId: 'v-1',
			startedAt: '2026-10-07T03:00:00.000Z',
			lastAt: '2026-10-07T03:02:00.000Z',
			visitor: 'a1b2',
			country: 'KR',
			device: 'desktop',
			browser: 'Chrome',
			os: 'macOS',
			referrer: 'github.com',
			path: '/',
			ip: '203.0.113.x',
			events: [
				{ type: 'visit', app: null, item: null, at: '2026-10-07T03:00:00.000Z' },
				{ type: 'app', app: 'memo', item: null, at: '2026-10-07T03:00:10.000Z' },
				{ type: 'item', app: 'memo', item: 'cra-to-vite', at: '2026-10-07T03:01:00.000Z' },
				{ type: 'link', app: null, item: 'github.com/hyeoniverse', at: '2026-10-07T03:02:00.000Z' },
			],
		},
	];
}

/** 관리자의 받은 편지함: 방문자 둘이 보낸 메일 (하나는 이미 답장함) */
function fakeInbox(): FakeContactMail[] {
	return [
		{
			id: 'mail-a',
			name: '민수',
			email: 'minsu@example.com',
			subject: '채용 제안드립니다',
			body: '안녕하세요, 포트폴리오 잘 봤습니다.\n이야기 나눠 보고 싶습니다.',
			createdAt: '2026-10-07T03:00:00.000Z',
			replies: [],
		},
		{
			id: 'mail-b',
			name: '지수',
			email: 'jisu@example.com',
			subject: '활동 상태 보기 질문',
			body: '어떻게 만드셨나요?',
			createdAt: '2026-10-06T03:00:00.000Z',
			replies: [{ id: 'reply-old', body: '글로 정리해 두었어요!', createdAt: '2026-10-06T05:00:00.000Z' }],
		},
	];
}
