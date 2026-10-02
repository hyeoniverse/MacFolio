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
		locks?: Record<string, boolean>;
		order?: string[];
	};
	/** 받은 PUT 요청 수 */
	saves: number;
	/** 글마다 댓글 (가짜 서버는 비밀번호를 그대로 들고 있다) */
	comments: Record<string, FakeComment[]>;
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
}

export interface FakeWallpaper {
	id: string;
	kind: 'mac' | 'ios';
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
		organization: { folders: [], posts: {}, moves: [], pins: {}, ...organization },
		saves: 0,
		comments: {},
		visitorName: '🦊 날쌘 여우',
		messageThreads: [],
		messages: [],
		posts: [],
		uploads: [],
		wallpapers: [],
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
		// 배경화면: 누구나 목록을 보고, 관리자만 더하고 지운다
		if (path === '/wallpapers' && request.method() === 'GET') {
			return route.fulfill({ status: 200, headers: cors(origin), json: state.wallpapers });
		}
		if (path === '/wallpapers' && request.method() === 'POST') {
			if (!state.signedIn) return route.fulfill(unauthorized);
			const parts = readMultipart(request.postDataBuffer()!);
			const field = (name: string) => parts.find((part) => part.field === name);
			const kind = field('kind')?.data.toString('utf8');
			const image = field('image');
			const thumbnail = field('thumbnail');
			if ((kind !== 'mac' && kind !== 'ios') || !image || !thumbnail) {
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
				kind,
				name: field('name')?.data.toString('utf8') || 'wallpaper',
				image: save(image),
				thumbnail: save(thumbnail),
			};
			state.wallpapers.push(wallpaper);
			return route.fulfill({ status: 201, headers: cors(origin), json: wallpaper });
		}
		const wallpaperPath = path.match(/^\/wallpapers\/([\w-]+)$/);
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
			if (request.method() === 'GET') return json(comments);
			const input = request.postDataJSON() as { body?: string };
			const comment: FakeComment = {
				id: `c${nextId++}`,
				...author(),
				body: input.body ?? '',
				createdAt: new Date().toISOString(),
				mine: true,
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
