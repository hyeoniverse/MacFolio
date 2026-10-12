// 키트 조각을 서버 렌더(renderToStaticMarkup)로 그려 짜임과 접근성을 본다 (효과·관찰자는 돌지 않는다)
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Project } from '@/shared/profile';
import { AppContext, type AppContextType } from '@/desktop/useAppState';
import { LOOK_SAMPLES, type SampleLook } from '@/apps/settings/lookSamples';
import { BentoGrid } from './BentoGrid';
import { CtaBand } from './CtaBand';
import { DeviceFrame } from './DeviceFrame';
import { FeatureVisual } from './FeatureVisual';
import { GlowBackdrop } from './GlowBackdrop';
import { LogoStrip } from './LogoStrip';
import { FEATURE_VARIANTS, MOCK_KINDS } from './mock';
import { MockScreen } from './MockScreen';
import { SectionHeader } from './SectionHeader';
import { StatBand } from './StatBand';

const sample = (look: SampleLook): Project => ({
	...LOOK_SAMPLES[look],
	id: `t-${look}`,
	url: 'https://github.com/a/b',
});

const blank: Project = {
	id: 'blank',
	name: '새 프로젝트',
	look: 'showcase',
	tagline: '',
	description: '',
	context: '',
	facts: [],
	highlights: [],
	build: [],
	contributions: [],
	specs: [],
	stack: [],
	language: '',
	url: 'https://github.com/a/b',
	image: '',
};

const render = (element: ReactElement) => renderToStaticMarkup(element);

/** 그린 HTML의 글 조각들 (태그 사이 글, 엔터티를 푼다) */
const texts = (html: string) =>
	[...html.matchAll(/>([^<]+)</g)]
		.map((match) =>
			match[1]
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#x27;/g, "'")
				.trim()
		)
		.filter(Boolean);

/** 값 안의 글을 모두 (깊이 들어가며) */
const strings = (value: unknown): string[] =>
	typeof value === 'string'
		? [value]
		: Array.isArray(value)
			? value.flatMap(strings)
			: value && typeof value === 'object'
				? Object.values(value).flatMap(strings)
				: [];

describe('MockScreen', () => {
	it.each(MOCK_KINDS)('%s: 보이는 글은 모두 프로젝트 데이터에서 온다 (가짜 문장 없음)', (kind) => {
		for (const look of Object.keys(LOOK_SAMPLES) as SampleLook[]) {
			const project = sample(look);
			const html = render(h(MockScreen, { project, kind, focus: 1 }));
			const data = strings(project).join('\n');
			for (const text of texts(html)) {
				// 상태 막대의 시각(9:41)과 아이콘 없는 앱의 첫 글자만 데이터 밖의 글
				if (text === '9:41') continue;
				expect(data, `${look}/${kind}: "${text}"`).toContain(text);
			}
		}
	});

	it('그림 하나로 읽히고(이름 붙은 img), 장식이면 숨는다', () => {
		const project = sample('showcase');
		expect(render(h(MockScreen, { project }))).toMatch(/role="img" aria-label="북클럽 화면 예시"/);
		const hidden = render(h(MockScreen, { project, decorative: true }));
		expect(hidden).toContain('aria-hidden="true"');
		expect(hidden).not.toContain('role="img"');
	});

	it('종류를 안 주면 프로젝트에서 고르고, 사이드바에 주요 기능 제목이 메뉴로 선다', () => {
		const project = sample('showcase');
		const html = render(h(MockScreen, { project, focus: 2 }));
		expect(html).toContain('data-kind="dashboard"');
		for (const point of project.highlights) expect(html).toContain(point.title);
		// 고른 항목이 본문 제목
		expect(html).toMatch(new RegExp(`lk-mock-title">${project.highlights[2].title}<`));
		expect(html).toContain(project.facts[0].value);
	});

	it('game은 어두운 화면이고 조작법을 키캡으로', () => {
		const html = render(h(MockScreen, { project: sample('arcade') }));
		expect(html).toContain('data-lk-tone="dark"');
		expect(html).toContain('<kbd>');
	});

	it.each(MOCK_KINDS)('%s: 데이터가 빈 새 프로젝트도 그린다 (자리 표시 막대로)', (kind) => {
		const html = render(h(MockScreen, { project: blank, kind }));
		expect(html).toContain('lk-mock');
		expect(texts(html).every((text) => ['새 프로젝트', '새', '9:41'].includes(text))).toBe(true);
	});
});

describe('DeviceFrame', () => {
	it('틀 종류마다 모양 조각이 붙고, 그림·영상·자식을 화면에 넣는다', () => {
		const browser = render(h(DeviceFrame, { kind: 'browser', src: '/a.png', alt: '화면', url: 'https://x.dev/' }));
		expect(browser).toContain('lk-device-lights');
		expect(browser).toContain('x.dev<');
		expect(browser).toContain('alt="화면"');
		const phone = render(h(DeviceFrame, { kind: 'phone', src: '/a.mp4' }));
		expect(phone).toContain('lk-device-island');
		expect(phone).toMatch(/<video[^>]*aria-hidden="true"/);
		const laptop = render(h(DeviceFrame, { kind: 'laptop' }, h('p', null, '안')));
		expect(laptop).toContain('lk-device-base');
		expect(laptop).toContain('<p>안</p>');
	});

	it('기본은 똑바로, 빛·반사·유리 광택 없이 그림자 하나', () => {
		const html = render(h(DeviceFrame, { kind: 'phone' }));
		expect(html).not.toContain('data-tilt');
		expect(html).not.toContain('data-glow');
		expect(html).not.toContain('data-reflection');
		expect(html).not.toContain('lk-device-glare');
		expect(html).toContain('data-shadow=""');
	});

	it('기울기·빛·반사는 켤 때만 data 속성으로', () => {
		const html = render(h(DeviceFrame, { tilt: true, glow: true, reflection: true }));
		expect(html).toContain('data-tilt="left"');
		expect(html).toContain('data-glow=""');
		expect(html).toContain('data-reflection=""');
		expect(render(h(DeviceFrame, { tilt: 'right', shadow: false }))).not.toContain('data-shadow');
	});
});

describe('FeatureVisual', () => {
	it('차례마다 변형이 돌고, 모두 장식(aria-hidden)이며 항목 제목을 담는다', () => {
		const project = sample('showcase');
		const variants = [0, 1, 2, 3].map((index) => {
			const point = { ...project.highlights[index], variants: undefined };
			const html = render(h(FeatureVisual, { point, index, project }));
			expect(html).toMatch(/^<div[^>]*aria-hidden="true"/);
			if (index !== 2) expect(html).toContain(point.title);
			return /data-variant="(\w+)"/.exec(html)?.[1];
		});
		expect(variants).toEqual([...FEATURE_VARIANTS]);
	});

	it('orbit의 칩은 항목의 갈래 이름, 없으면 기술', () => {
		const point = { title: 'T', body: '', variants: [{ label: '갈래1', note: '' }] };
		expect(render(h(FeatureVisual, { point, index: 2 }))).toContain('갈래1');
		expect(
			render(h(FeatureVisual, { point: { title: 'T', body: '' }, index: 2, project: sample('arcade') }))
		).toContain('Phaser 3');
		expect(render(h(FeatureVisual, { point: { title: 'T', body: '' }, index: 2 }))).toContain('>T<');
	});
});

describe('띠와 머리', () => {
	it('StatBand: 숫자마다 한 칸, 없으면 그리지 않는다', () => {
		const html = render(h(StatBand, { facts: sample('showcase').facts }));
		expect(html).toContain('aria-label="한눈에"');
		expect(html.match(/<li/g)).toHaveLength(4);
		expect(render(h(StatBand, { facts: [] }))).toBe('');
	});

	it('LogoStrip: 겹친 이름은 한 번, 흐르는 띠의 둘째 줄은 보조 기술에 숨긴다', () => {
		const html = render(h(LogoStrip, { items: ['React', 'React', 'Vite'], marquee: true, caption: '만든 기술' }));
		expect(html).toContain('만든 기술');
		expect(html.match(/<ul class="lk-logos-track" aria-label="기술">/g)).toHaveLength(1);
		expect(html).toContain('lk-logos-clone" aria-hidden="true"');
		expect(html.match(/>React</g)).toHaveLength(2);
		expect(render(h(LogoStrip, { items: [] }))).toBe('');
	});

	it('SectionHeader: 라벨, 제목 태그, 부제, 정렬', () => {
		const html = render(
			h(SectionHeader, { eyebrow: '주요 기능', title: '제목', lead: '부제', as: 'h3', align: 'start', id: 'x' })
		);
		expect(html).toContain('<p class="lk-eyebrow">주요 기능</p>');
		expect(html).toContain('<h3 id="x" class="lk-section-title">제목</h3>');
		expect(html).toContain('data-align="start"');
	});

	it('GlowBackdrop: 장식 층, 무늬와 톤', () => {
		const html = render(h(GlowBackdrop, { tone: 'light', pattern: 'dots' }));
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('data-lk-tone="light"');
		expect(html).toContain('lk-glow-pattern');
		expect(render(h(GlowBackdrop, { pattern: 'none' }))).not.toContain('lk-glow-pattern');
	});

	it('GlowBackdrop: 기본은 무늬만 (빛 덩어리·움직임 없음), glow를 켜야 한 덩어리', () => {
		const plain = render(h(GlowBackdrop, {}));
		expect(plain).not.toContain('lk-glow-blob');
		expect(plain).not.toContain('data-animate');
		expect(render(h(GlowBackdrop, { glow: true })).match(/lk-glow-blob/g)).toHaveLength(1);
	});

	it('SectionHeader·StatBand: 그라데이션 글자 없이 단색', () => {
		const head = render(h(SectionHeader, { title: '제목', gradient: true }));
		expect(head).not.toContain('gradient');
		expect(render(h(StatBand, { facts: sample('showcase').facts, gradient: true }))).not.toContain('data-gradient');
	});

	it('CtaBand: 큰 문장(기본 tagline)과 링크, 바탕은 기본 단색 (무늬는 고를 때만)', () => {
		const project = sample('showcase');
		const ctx = new Proxy({}, { get: () => () => undefined }) as unknown as AppContextType;
		const html = render(h(AppContext.Provider, { value: ctx }, h(CtaBand, { project })));
		expect(html).toContain(`<h2 class="lk-cta-title">${project.tagline}</h2>`);
		expect(html).toContain('GitHub에서 보기');
		expect(html).not.toContain('lk-glow');
		const dotted = render(h(AppContext.Provider, { value: ctx }, h(CtaBand, { project, pattern: 'dots' })));
		expect(dotted).toContain('lk-glow-pattern');
		expect(dotted).not.toContain('lk-glow-blob');
	});
});

describe('BentoGrid', () => {
	it('항목마다 칸 크기를 CSS 변수와 data-size로 단다', () => {
		const html = render(
			h(BentoGrid<string>, {
				items: ['a', 'b', 'c', 'd', 'e'],
				label: '주요 기능',
				render: (item, cell) => h('span', null, `${item}:${cell.size}`),
			})
		);
		expect(html).toContain('aria-label="주요 기능"');
		expect(html).toContain('a:lg');
		expect(html).toContain('style="--col:4;--row:2"');
		expect(html).toContain('e:wide');
		expect(render(h(BentoGrid<string>, { items: [], render: () => null }))).toBe('');
	});
});
