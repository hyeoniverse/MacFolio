import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LOOK,
	demoOrigins,
	LEGACY_LOOKS,
	mergeProjects,
	overrideOf,
	parseProjects,
	PROJECT_LOOKS,
	readProjects,
	type Project,
} from './projects.js';

const base = (id: string, extra: Partial<Project> = {}): Project => ({
	id,
	name: id.toUpperCase(),
	look: 'product',
	tagline: '한 줄',
	description: '소개',
	context: '개인',
	facts: [],
	highlights: [],
	build: [],
	contributions: [],
	specs: [],
	stack: ['React'],
	language: 'TypeScript',
	url: `https://github.com/me/${id}`,
	image: `/imgs/projects/${id}/screenshot.jpg`,
	...extra,
});

describe('parseProjects', () => {
	it('순서·숨김·덮어쓰기를 받고, 글자는 다듬고 모르는 필드는 버린다', () => {
		const parsed = parseProjects({
			items: [
				{ id: 'b', override: { name: '  새 이름 ', secret: 'x', stack: ['Vue'] }, extra: 1 },
				{ id: 'a', hidden: true },
				{ id: 'c', hidden: false },
			],
		});
		expect(parsed).toEqual({
			value: {
				items: [{ id: 'b', override: { name: '새 이름', stack: ['Vue'] } }, { id: 'a', hidden: true }, { id: 'c' }],
			},
		});
	});

	it('링크·iframe 주소는 https만, 그림은 사이트 안 경로나 https만 받는다 (javascript: 같은 주소는 거절)', () => {
		const parsed = parseProjects({
			items: [
				{
					id: 'x',
					override: {
						url: 'javascript:alert(1)',
						demo: 'http://example.com',
						image: 'data:image/png;base64,AAAA',
						credits: [{ role: '글꼴', name: 'a', by: 'b', href: 'javascript:alert(1)' }],
						gallery: [{ src: "/imgs/a.png') ;background:url(x", caption: 'c' }],
					},
				},
			],
		});
		expect('errors' in parsed && parsed.errors).toEqual([
			'프로젝트 x.gallery[0].src: 사이트 안 경로(/imgs/…)나 https:// 주소여야 합니다.',
			'프로젝트 x.credits[0].href: https:// 주소여야 합니다.',
			'프로젝트 x.url: https:// 주소여야 합니다.',
			'프로젝트 x.demo: https:// 주소여야 합니다.',
			'프로젝트 x.image: 사이트 안 경로(/imgs/…)나 https:// 주소여야 합니다.',
		]);
	});

	it('발표 자료(slides)는 문서 폴더의 PDF 키만 받는다', () => {
		expect(parseProjects({ items: [{ id: 'x', override: { slides: 'portfolio/abcDEF_123-x.pdf' } }] })).toEqual({
			value: { items: [{ id: 'x', override: { slides: 'portfolio/abcDEF_123-x.pdf' } }] },
		});
		expect(parseProjects({ items: [{ id: 'x', override: { slides: null } }] })).toEqual({
			value: { items: [{ id: 'x', override: { slides: null } }] },
		});
		for (const bad of ['portfolio/a.png', 'etc/a.pdf', '../resume/a.pdf', 'resume/a/b.pdf', 'https://x.dev/a.pdf']) {
			const parsed = parseProjects({ items: [{ id: 'x', override: { slides: bad } }] });
			expect('errors' in parsed && parsed.errors).toEqual(['프로젝트 x.slides: 모양이 맞지 않습니다.']);
		}
	});

	it('id 규칙: 모양, 앱 이름과 겹침, 같은 id 두 번', () => {
		const parsed = parseProjects({ items: [{ id: 'Bad Id' }, { id: 'safari' }, { id: 'ok' }, { id: 'ok' }] });
		expect('errors' in parsed && parsed.errors).toEqual([
			'프로젝트 Bad Id: id는 영어 소문자·숫자·-로 40자까지입니다 (첫 글자는 영어나 숫자).',
			"프로젝트 safari: 'safari'는 이 사이트의 앱 이름이라 쓸 수 없습니다.",
			'프로젝트 ok: 같은 id가 두 번 있습니다.',
		]);
	});

	it('안쪽 묶음의 필수 필드, 열거값, 숫자 범위, 색을 본다. null은 고를 수 있는 필드만 지운다', () => {
		const parsed = parseProjects({
			items: [
				{
					id: 'x',
					override: {
						look: 'fancy',
						highlights: [{ title: '제목' }],
						app: { label: '앱', icon: '../../etc/passwd', barColor: 'red; x', windowSize: { width: 10, height: 600 } },
						name: null,
						demo: null,
					},
				},
			],
		});
		expect('errors' in parsed && parsed.errors).toEqual([
			'프로젝트 x.name: 지울 수 없는 필드입니다.',
			'프로젝트 x.look: product, friendly, paper, bento, keynote, magazine, devtool, repo, playful, custom 가운데 하나여야 합니다.',
			'프로젝트 x.highlights[0].body: 꼭 있어야 합니다.',
			'프로젝트 x.app.icon: 이미지 폴더 기준 경로(projects/…/icon.png)나 https:// 주소여야 합니다.',
			'프로젝트 x.app.barColor: 색(#rrggbb, rgb())이어야 합니다.',
			'프로젝트 x.app.windowSize.width: 320~2400 사이의 숫자여야 합니다.',
		]);
		expect(parseProjects({ items: [{ id: 'x', override: { demo: null, app: null } }] })).toEqual({
			value: { items: [{ id: 'x', override: { demo: null, app: null } }] },
		});
	});

	it('예전 모양 이름은 지금 모양으로 바꿔 받고, 저장해 둔 값을 읽을 때도 바꾼다', () => {
		expect(LEGACY_LOOKS).toEqual({
			showcase: 'friendly',
			assistant: 'friendly',
			cinema: 'keynote',
			phone: 'product',
			atelier: 'magazine',
			inbox: 'paper',
			checklist: 'paper',
			horizontal: 'bento',
			deck: 'keynote',
			arcade: 'playful',
			brutal: 'bento',
			dialogue: 'friendly',
		});
		// 바꾼 값은 모두 지금 있는 모양이고, 예전 이름과 지금 이름이 겹치지 않는다
		for (const [old, look] of Object.entries(LEGACY_LOOKS)) {
			expect(PROJECT_LOOKS).toContain(look);
			expect(PROJECT_LOOKS as readonly string[]).not.toContain(old);
		}
		const items = Object.keys(LEGACY_LOOKS).map((look, index) => ({ id: `p${index}`, override: { look } }));
		const parsed = parseProjects({ items });
		if ('errors' in parsed) throw new Error(parsed.errors.join('\n'));
		expect(parsed.value.items.map((item) => item.override?.look)).toEqual(Object.values(LEGACY_LOOKS));
		// 지금 이름은 그대로, DB에 남은 옛 이름도 읽을 때 바뀐다
		expect(
			readProjects({
				items: [
					{ id: 'a', override: { look: 'paper' } },
					{ id: 'b', override: { look: 'cinema' } },
				],
			})
		).toEqual({
			items: [
				{ id: 'a', override: { look: 'paper' } },
				{ id: 'b', override: { look: 'keynote' } },
			],
		});
		// 객체 기본 속성 이름은 예전 이름이 아니다
		expect('errors' in parseProjects({ items: [{ id: 'x', override: { look: 'toString' } }] })).toBe(true);
		expect(DEFAULT_LOOK).toBe('friendly');
	});

	it('허용한 출처(로컬 API)의 http 주소는 받는다 (올린 그림의 /files 주소)', () => {
		const allowOrigins = ['http://localhost:3000'];
		const items = [
			{
				id: 'x',
				override: {
					logo: 'http://localhost:3000/files/abc',
					app: { label: 'a', icon: 'http://localhost:3000/files/def' },
				},
			},
		];
		expect(parseProjects({ items }, { allowOrigins })).toEqual({ value: { items } });
		expect('errors' in parseProjects({ items })).toBe(true);
		expect(
			'errors' in
				parseProjects({ items: [{ id: 'x', override: { logo: 'http://evil.test/a.png' } }] }, { allowOrigins })
		).toBe(true);
		expect(readProjects({ items }, { allowOrigins })).toEqual({ items });
	});

	it('화면 캡처는 비워도 된다 (다른 그림 주소는 비우면 거절)', () => {
		expect(parseProjects({ items: [{ id: 'x', override: { image: '' } }] })).toEqual({
			value: { items: [{ id: 'x', override: { image: '' } }] },
		});
		expect(parseProjects({ items: [{ id: 'x', override: { logo: '' } }] })).toEqual({
			errors: ['프로젝트 x.logo: 사이트 안 경로(/imgs/…)나 https:// 주소여야 합니다.'],
		});
	});

	it('화면 모음 폴더는 /imgs 아래 경로만 (.. 없이)', () => {
		expect(parseProjects({ items: [{ id: 'x', override: { galleryFolder: '/imgs/projects/x/shots' } }] })).toEqual({
			value: { items: [{ id: 'x', override: { galleryFolder: '/imgs/projects/x/shots' } }] },
		});
		for (const galleryFolder of ['/assets', '/imgs/../secret', 'https://example.com/imgs/a', '/imgs/a b'])
			expect(parseProjects({ items: [{ id: 'x', override: { galleryFolder } }] })).toEqual({
				errors: ['프로젝트 x.galleryFolder: 모양이 맞지 않습니다.'],
			});
	});

	it('없어진 대화창 배경(backdrop)을 저장해 둔 값도 받고, 그 필드만 버린다', () => {
		expect(
			parseProjects({
				items: [{ id: 'x', override: { name: 'X', backdrop: { theme: 'sea', image: '/imgs/bg.png' } } }],
			})
		).toEqual({ value: { items: [{ id: 'x', override: { name: 'X' } }] } });
		// 예전 규칙에 맞지 않던 값이나 null도 오류 없이 버린다
		expect(
			parseProjects({ items: [{ id: 'x', override: { backdrop: { theme: 'jungle', image: 'javascript:1' } } }] })
		).toEqual({ value: { items: [{ id: 'x' }] } });
		expect(parseProjects({ items: [{ id: 'x', override: { backdrop: null, art: '/imgs/a.png' } }] })).toEqual({
			value: { items: [{ id: 'x', override: { art: '/imgs/a.png' } }] },
		});
		expect(readProjects({ items: [{ id: 'x', override: { backdrop: { theme: 'farm' } } }] })).toEqual({
			items: [{ id: 'x' }],
		});
	});

	it('트러블슈팅·팀원·배포 결과물을 받고, 글자는 다듬고 모르는 필드는 버린다', () => {
		const parsed = parseProjects({
			items: [
				{
					id: 'x',
					override: {
						troubleshooting: [
							{
								title: ' 느린 첫 화면 ',
								problem: '첫 화면이 4초 걸렸다',
								cause: '번들이 컸다',
								solution: '나눠 불렀다',
								result: '1.2초',
								image: '/imgs/a.png',
								icon: 'fa-bug',
								secret: 1,
							},
							{ title: '그림 없음', problem: 'p', solution: 's' },
						],
						team: [
							{ name: '김', role: '프론트엔드', url: 'https://github.com/kim', avatar: '/imgs/k.png', me: true, x: 1 },
							{ name: '이', role: '디자인' },
						],
						deployments: [
							{ label: '웹', url: 'https://a.vercel.app', platform: 'Vercel', note: '운영', image: '/imgs/w.png' },
							{ label: '설계 문서' },
						],
					},
				},
			],
		});
		expect(parsed).toEqual({
			value: {
				items: [
					{
						id: 'x',
						override: {
							troubleshooting: [
								{
									title: '느린 첫 화면',
									problem: '첫 화면이 4초 걸렸다',
									cause: '번들이 컸다',
									solution: '나눠 불렀다',
									result: '1.2초',
									image: '/imgs/a.png',
									icon: 'fa-bug',
								},
								{ title: '그림 없음', problem: 'p', solution: 's' },
							],
							team: [
								{ name: '김', role: '프론트엔드', url: 'https://github.com/kim', avatar: '/imgs/k.png', me: true },
								{ name: '이', role: '디자인' },
							],
							deployments: [
								{ label: '웹', url: 'https://a.vercel.app', platform: 'Vercel', note: '운영', image: '/imgs/w.png' },
								{ label: '설계 문서' },
							],
						},
					},
				],
			},
		});
	});

	it('트러블슈팅·팀원·배포 결과물의 주소·필수·개수·모양을 본다', () => {
		const parsed = parseProjects({
			items: [
				{
					id: 'x',
					override: {
						troubleshooting: [{ title: 't', problem: 'p', icon: 'bug' }],
						team: [{ name: 'n', role: 'r', url: 'javascript:alert(1)', avatar: 'javascript:x', me: 'yes' }],
						deployments: Array.from({ length: 13 }, () => ({ label: 'l' })),
					},
				},
				{ id: 'y', override: { deployments: [{ label: 'l', url: 'javascript:alert(1)' }] } },
				{ id: 'z', override: { team: Array.from({ length: 21 }, () => ({ name: 'n', role: 'r' })) } },
			],
		});
		expect('errors' in parsed && parsed.errors).toEqual([
			'프로젝트 x.troubleshooting[0].solution: 꼭 있어야 합니다.',
			'프로젝트 x.troubleshooting[0].icon: 모양이 맞지 않습니다.',
			'프로젝트 x.team[0].url: https:// 주소여야 합니다.',
			'프로젝트 x.team[0].avatar: 사이트 안 경로(/imgs/…)나 https:// 주소여야 합니다.',
			'프로젝트 x.team[0].me: true나 false여야 합니다.',
			'프로젝트 x.deployments: 12개까지입니다.',
			'프로젝트 y.deployments[0].url: https:// 주소여야 합니다.',
			'프로젝트 z.team: 20개까지입니다.',
		]);
	});

	it('너무 길거나 많으면 거절하고, 틀린 값이 DB에 있으면 읽을 때 null', () => {
		expect(parseProjects({ items: Array.from({ length: 41 }, (_, i) => ({ id: `p${i}` })) })).toEqual({
			errors: ['프로젝트는 40개까지입니다.'],
		});
		expect(parseProjects({ items: [{ id: 'x', override: { structure: 'a'.repeat(95_000) } }] })).toEqual({
			errors: ['프로젝트 내용이 너무 깁니다 (90,000자까지).'],
		});
		expect(readProjects(null)).toBeNull();
		expect(readProjects({ items: [{ id: 'safari' }] })).toBeNull();
		expect(readProjects({ items: [{ id: 'a' }] })).toEqual({ items: [{ id: 'a' }] });
	});
});

describe('mergeProjects', () => {
	const defaults = [base('a'), base('b', { demo: 'https://b.example', app: { label: 'B', icon: 'b.png' } }), base('c')];

	it('저장한 것이 없으면 코드 그대로', () => {
		expect(mergeProjects(defaults, null).map((p) => p.id)).toEqual(['a', 'b', 'c']);
	});

	it('서버 순서대로 덮어쓰고, 숨긴 것은 빼고, 목록에 없는 코드 프로젝트는 끝에 붙는다', () => {
		const merged = mergeProjects(defaults, {
			items: [
				{ id: 'c', override: { name: '씨' } },
				{ id: 'a', hidden: true },
			],
		});
		expect(merged.map((p) => [p.id, p.name])).toEqual([
			['c', '씨'],
			['b', 'B'],
		]);
	});

	it('null은 필드를 지우고(앱 끄기), 코드에 없는 id는 빈 바탕에 채운 새 프로젝트', () => {
		const merged = mergeProjects(defaults, {
			items: [
				{ id: 'b', override: { app: null } },
				{ id: 'new', override: { name: '새 프로젝트', url: 'https://github.com/me/new' } },
			],
		});
		expect(merged[0].app).toBeUndefined();
		expect('app' in merged[0]).toBe(false);
		expect(merged[1]).toMatchObject({ id: 'new', name: '새 프로젝트', look: 'friendly', highlights: [], stack: [] });
	});
});

describe('overrideOf', () => {
	it('기본값과 다른 맨 위 필드만, 지운 필드는 null, 새 프로젝트는 전부', () => {
		const original = base('b', { demo: 'https://b.example', period: '2주' });
		const edited: Project = { ...original, name: '비', stack: ['React'], period: undefined };
		expect(overrideOf(edited, original)).toEqual({ name: '비', period: null });
		const fresh = base('n');
		expect(Object.keys(overrideOf(fresh, undefined) ?? {})).not.toContain('id');
		expect(overrideOf(fresh, undefined)).toMatchObject({ name: 'N', url: 'https://github.com/me/n' });
	});
});

describe('demoOrigins', () => {
	it('https 데모 주소의 출처만, 겹치지 않게', () => {
		expect(
			demoOrigins([
				{ demo: 'https://a.example/play?x=1' },
				{ demo: 'https://a.example/other' },
				{ demo: 'http://insecure.example' },
				{ demo: 'nope' },
				{},
			])
		).toEqual(['https://a.example']);
	});
});
