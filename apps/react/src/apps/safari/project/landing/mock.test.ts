import { describe, expect, it } from 'vitest';
import type { Project } from '@/shared/profile';
import { LOOK_SAMPLES, type SampleLook } from '@/apps/settings/lookSamples';
import {
	hashString,
	iconOf,
	mockPoints,
	mockSeries,
	parseFactNumber,
	parseTree,
	pickMockKind,
	seriesPath,
	shortName,
} from './mock';

const sample = (look: SampleLook): Project => ({
	...LOOK_SAMPLES[look],
	id: `t-${look}`,
	url: 'https://github.com/a/b',
});

/** 빈 새 프로젝트 (필수 필드만) */
const blank = (over: Partial<Project> = {}): Project => ({
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
	...over,
});

describe('pickMockKind', () => {
	it('모양별 예시 프로젝트마다 어울리는 화면을 고른다', () => {
		const picked = Object.fromEntries(
			(Object.keys(LOOK_SAMPLES) as SampleLook[]).map((look) => [look, pickMockKind(sample(look))])
		);
		expect(picked).toEqual({
			showcase: 'dashboard',
			cinema: 'list', // 소개에 '할 일'
			phone: 'mobile',
			horizontal: 'dashboard',
			brutal: 'editor',
			arcade: 'game',
			atelier: 'list',
			inbox: 'list',
			checklist: 'list',
			repo: 'editor',
			dialogue: 'game',
			deck: 'editor',
			assistant: 'chat',
		});
	});

	it('조작법·플레이·게임 엔진이 있으면 game', () => {
		expect(pickMockKind(blank({ controls: [{ keys: ['Space'], label: '점프' }] }))).toBe('game');
		expect(pickMockKind(blank({ stack: ['Godot'] }))).toBe('game');
	});

	it('앱 기술이면 mobile, 대화·AI면 chat, 아무것도 없으면 dashboard', () => {
		expect(pickMockKind(blank({ stack: ['Flutter', 'Dart'] }))).toBe('mobile');
		expect(pickMockKind(blank({ stack: ['Next.js', 'OpenAI'] }))).toBe('chat');
		expect(pickMockKind(blank({ name: '팀 메신저' }))).toBe('chat');
		expect(pickMockKind(blank())).toBe('dashboard');
	});
});

describe('mockSeries', () => {
	it('같은 씨앗이면 같은 값, 다른 씨앗이면 다른 모양', () => {
		expect(mockSeries('a', 10)).toEqual(mockSeries('a', 10));
		expect(mockSeries('a', 10)).not.toEqual(mockSeries('b', 10));
	});

	it('값은 0~1 사이이고, 뒤쪽 평균이 앞쪽보다 높다 (오르는 그래프)', () => {
		for (const seed of ['북클럽', '120개', 'x', '']) {
			const values = mockSeries(seed, 12);
			expect(values).toHaveLength(12);
			for (const v of values) {
				expect(v).toBeGreaterThan(0);
				expect(v).toBeLessThanOrEqual(1);
			}
			const avg = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
			expect(avg(values.slice(6))).toBeGreaterThan(avg(values.slice(0, 6)));
		}
	});

	it('seriesPath: 점마다 한 마디, 면은 바닥까지 닫는다', () => {
		expect(seriesPath([0, 1], 100, 50)).toBe('M0.0,50.0 L100.0,0.0');
		expect(seriesPath([0, 1], 100, 50, true)).toBe('M0.0,50.0 L100.0,0.0 L100,50 L0,50 Z');
		expect(seriesPath([], 100, 50)).toBe('');
	});
});

describe('글 도우미', () => {
	it('parseFactNumber: 쉼표·소수·단위를 읽는다', () => {
		expect(parseFactNumber('1,800명')).toBe(1800);
		expect(parseFactNumber('92%')).toBe(92);
		expect(parseFactNumber('4.8점')).toBe(4.8);
		expect(parseFactNumber('TOP 10')).toBe(10);
		expect(parseFactNumber('없음')).toBeNull();
	});

	it('shortName: 대시 앞 이름, 앱 이름이 있으면 그것', () => {
		expect(shortName({ name: '북클럽 – 독서 모임 플랫폼' })).toBe('북클럽');
		expect(shortName({ name: 'SproutFarm' })).toBe('SproutFarm');
		expect(shortName({ name: '긴 이름 - 부제', app: { label: '짧게', icon: 'x.png' } })).toBe('짧게');
	});

	it('iconOf: 항목 아이콘, 없으면 차례대로 돌려 쓰는 기본 아이콘', () => {
		expect(iconOf({ icon: 'fa-lock' }, 3)).toBe('fa-lock');
		expect(iconOf({}, 0)).toMatch(/^fa-/);
		expect(iconOf(undefined, 1)).not.toBe(iconOf(undefined, 0));
		expect(iconOf(undefined, -1)).toMatch(/^fa-/);
	});

	it('mockPoints: 주요 기능 → 쓰는 법 → 만든 방식, 제목 없는 것은 뺀다', () => {
		const project = blank({
			highlights: [{ title: 'A', body: '' }],
			usage: [
				{ title: ' ', body: 'x' },
				{ title: 'B', body: '' },
			],
			build: [{ title: 'C', body: '' }],
		});
		expect(mockPoints(project).map((point) => point.title)).toEqual(['A', 'B', 'C']);
	});

	it('parseTree: 트리 그림 글자와 주석을 걷어 내고 깊이를 센다', () => {
		const rows = parseTree('src/\n├── app/\n│   └── main.ts   # 시작\n└── README.md');
		expect(rows).toEqual([
			{ name: 'src/', depth: 0 },
			{ name: 'app/', depth: 1 },
			{ name: 'main.ts', depth: 2 },
			{ name: 'README.md', depth: 1 },
		]);
		expect(parseTree(undefined)).toEqual([]);
	});

	it('hashString: 늘 같은 양의 정수', () => {
		expect(hashString('abc')).toBe(hashString('abc'));
		expect(hashString('abc')).toBeGreaterThanOrEqual(0);
	});
});
