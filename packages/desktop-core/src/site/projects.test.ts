import { describe, expect, it } from 'vitest';
import { demoOrigins, mergeProjects, overrideOf, parseProjects, readProjects, type Project } from './projects.js';

const base = (id: string, extra: Partial<Project> = {}): Project => ({
	id,
	name: id.toUpperCase(),
	look: 'minimal',
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
			'프로젝트 x.look: showcase, editorial, playful, minimal, game, terminal, product, creative 가운데 하나여야 합니다.',
			'프로젝트 x.highlights[0].body: 꼭 있어야 합니다.',
			'프로젝트 x.app.icon: 이미지 폴더 기준 경로(projects/…/icon.png)나 https:// 주소여야 합니다.',
			'프로젝트 x.app.barColor: 색(#rrggbb, rgb())이어야 합니다.',
			'프로젝트 x.app.windowSize.width: 320~2400 사이의 숫자여야 합니다.',
		]);
		expect(parseProjects({ items: [{ id: 'x', override: { demo: null, app: null } }] })).toEqual({
			value: { items: [{ id: 'x', override: { demo: null, app: null } }] },
		});
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
		expect(merged[1]).toMatchObject({ id: 'new', name: '새 프로젝트', look: 'showcase', highlights: [], stack: [] });
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
