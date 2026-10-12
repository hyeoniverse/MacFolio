import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankProject, parseProjects, PROJECT_LOOKS, PROJECTS_LIMITS } from '@macfolio/desktop-core/site';
import { parsePeriod } from './projectInputs';
import {
	fillWithSample,
	GENERAL_SAMPLE,
	LANDING_FIELDS,
	LOOK_FIELDS,
	LOOK_SAMPLES,
	sampleFor,
	type SampleLook,
} from './lookSamples';

const LOOKS = PROJECT_LOOKS.filter((look): look is SampleLook => look !== 'custom');
const PUBLIC = resolve(__dirname, '../../../public');

/** 예시 안의 그림 주소 전부 */
const picturesOf = (value: unknown): string[] =>
	typeof value === 'string'
		? value.startsWith('/imgs/')
			? [value]
			: []
		: Array.isArray(value)
			? value.flatMap(picturesOf)
			: value && typeof value === 'object'
				? Object.values(value).flatMap(picturesOf)
				: [];

const filled = (value: unknown) =>
	Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? value !== null : Boolean(value);

describe('모양별 예시 프로젝트', () => {
	it('직접 짠 페이지를 뺀 모양마다 하나씩 있고, 네 랜딩 템플릿은 같은 예시를 모양만 바꿔 쓴다', () => {
		expect(Object.keys(LOOK_SAMPLES).sort()).toEqual([...LOOKS].sort());
		expect(LOOKS).toEqual([
			'product',
			'friendly',
			'paper',
			'bento',
			'keynote',
			'magazine',
			'devtool',
			'playful',
			'dialogue',
		]);
		for (const look of [
			'product',
			'friendly',
			'paper',
			'bento',
			'keynote',
			'magazine',
			'devtool',
			'playful',
		] as const) {
			const { look: _look, ...rest } = LOOK_SAMPLES[look];
			const { look: _general, ...general } = GENERAL_SAMPLE;
			expect(rest, look).toEqual(general);
			expect(LOOK_FIELDS[look]).toEqual(LANDING_FIELDS);
		}
		// 공통 예시는 새 프로젝트의 기본 모양
		expect(GENERAL_SAMPLE.look).toBe(blankProject('x').look);
	});

	it.each(LOOKS)('%s: 서버와 같은 검사를 그대로 통과한다 (버리거나 바뀌는 값이 없다)', (look) => {
		const sample = LOOK_SAMPLES[look];
		const override = { ...sample, url: 'https://github.com/example/sample' };
		const parsed = parseProjects({ items: [{ id: `sample-${look}`, override }] });
		if ('errors' in parsed) throw new Error(parsed.errors.join('\n'));
		expect(parsed.value.items[0].override).toEqual(override);
		// 한 프로젝트가 저장 한도의 6분의 1을 넘지 않는다 (예시를 여러 개 더해도 저장할 수 있게)
		expect(JSON.stringify(override).length).toBeLessThan(PROJECTS_LIMITS.json / 6);
	});

	it.each(LOOKS)('%s: 모양이 맞고, 그 모양이 읽는 필드를 모두 채운다', (look) => {
		const sample = LOOK_SAMPLES[look];
		expect(sample.look).toBe(look);
		expect(sample.name.trim()).not.toBe('');
		for (const field of LOOK_FIELDS[look]) expect(filled(sample[field]), `${look}.${field}`).toBe(true);
		// 분량: 꽉 차 보이게
		expect(sample.stack.length).toBeGreaterThanOrEqual(6);
		expect(sample.stack.length).toBeLessThanOrEqual(10);
		expect(sample.facts.length).toBeGreaterThanOrEqual(3);
		expect(sample.facts.length).toBeLessThanOrEqual(4);
		expect(sample.highlights.length).toBeGreaterThanOrEqual(4);
		expect(sample.highlights.length).toBeLessThanOrEqual(6);
		expect(sample.highlights.every((point) => point.detail)).toBe(true);
		expect(sample.build.length).toBeGreaterThanOrEqual(3);
		expect(sample.build.length).toBeLessThanOrEqual(4);
		expect(sample.usage?.length).toBeGreaterThanOrEqual(2);
		expect(sample.usage?.length).toBeLessThanOrEqual(3);
		expect(sample.timeline?.length).toBeGreaterThanOrEqual(5);
		expect(sample.timeline?.length).toBeLessThanOrEqual(8);
		expect(sample.specs.length).toBeGreaterThanOrEqual(4);
		expect(sample.specs.length).toBeLessThanOrEqual(6);
		expect(sample.contributions.length).toBeGreaterThanOrEqual(4);
		expect(sample.contributions.length).toBeLessThanOrEqual(6);
		if (sample.chapters) {
			expect(sample.chapters.length).toBeGreaterThanOrEqual(2);
			expect(sample.chapters.length).toBeLessThanOrEqual(3);
		}
		if (look !== 'dialogue') {
			// 랜딩 템플릿의 예시는 항목 칸(아이콘·그림·화면 여러 장)과 장 칸(숫자·그림)까지 써 본다
			expect(sample.highlights.every((point) => point.icon)).toBe(true);
			expect(sample.highlights.some((point) => point.image && point.imageDark)).toBe(true);
			expect(sample.highlights.some((point) => point.shots?.length)).toBe(true);
			expect(sample.build.some((point) => point.image)).toBe(true);
			expect(sample.chapters?.some((chapter) => chapter.facts?.length && chapter.image)).toBe(true);
			expect(sample.controls?.length).toBeGreaterThanOrEqual(3);
			expect(sample.credits?.length).toBeGreaterThanOrEqual(2);
		}
		// 기간은 편집 화면의 달력이 읽는 모양이다
		expect(parsePeriod(sample.period)?.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it.each(LOOKS)('%s: 그림은 저장소에 이미 있는 것만 쓴다', (look) => {
		for (const src of picturesOf(LOOK_SAMPLES[look])) expect(existsSync(`${PUBLIC}${src}`), src).toBe(true);
	});
});

describe('예시로 채우기', () => {
	it('id·저장소·데모·앱은 그대로 두고 나머지를 지금 모양의 예시로 바꾼다', () => {
		const project = {
			...blankProject('side-app'),
			look: 'dialogue' as const,
			url: 'https://github.com/example/side-app',
			demo: 'https://example.com',
			app: { label: '사이드 앱', icon: 'projects/qru/app-icon.png' },
			galleryFolder: '/imgs/projects/qru/screens',
		};
		const filledProject = fillWithSample(project);
		expect(filledProject).toMatchObject({
			id: 'side-app',
			url: 'https://github.com/example/side-app',
			demo: 'https://example.com',
			app: { label: '사이드 앱' },
			name: LOOK_SAMPLES.dialogue.name,
			look: 'dialogue',
			backdrop: { theme: 'farm' },
		});
		// 예시에 없는 필드(화면 모음 폴더)는 지운다
		expect(filledProject.galleryFolder).toBeUndefined();
		// 예시 자체는 고치지 않는다 (고친 칸이 다음 예시에 남지 않게)
		filledProject.highlights[0].title = '고친 제목';
		expect(LOOK_SAMPLES.dialogue.highlights[0].title).not.toBe('고친 제목');
	});

	it('직접 짠 페이지는 공통 예시를 쓰고 모양은 그대로 둔다', () => {
		expect(sampleFor('custom')).toMatchObject({ look: 'custom', name: GENERAL_SAMPLE.name });
	});
});
