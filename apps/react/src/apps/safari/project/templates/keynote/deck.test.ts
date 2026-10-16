import { describe, expect, it } from 'vitest';
import { blankProject, type Project } from '@macfolio/desktop-core/site';
import { GENERAL_SAMPLE } from '@/apps/settings/lookSamples';
import { landingOf, SECTION_ORDER } from '@/apps/safari/project/landing';
import { slidesOf } from './deck';

const sample: Project = { ...structuredClone(GENERAL_SAMPLE), id: 'sample', url: 'https://github.com/me/sample' };

describe('slidesOf', () => {
	it('표지 → 구역 차례대로의 장 → 마지막 인사이고, 숫자·기능·화면·트러블슈팅·이야기는 하나에 한 장이다', () => {
		const slides = slidesOf(landingOf(sample));
		expect(slides[0].type).toBe('title');
		expect(slides.at(-1)?.type).toBe('end');
		const kinds = slides.flatMap((slide) => (slide.type === 'section' ? [slide.section.kind] : []));
		expect([...new Set(kinds)]).toEqual(SECTION_ORDER);
		const count = (kind: string) => kinds.filter((k) => k === kind).length;
		expect(count('stats')).toBe(sample.facts.length);
		expect(count('features')).toBe(sample.highlights.length);
		expect(count('screens')).toBe(sample.gallery?.length);
		expect(count('troubleshooting')).toBe(sample.troubleshooting?.length);
		expect(count('stories')).toBe(sample.chapters?.length);
		expect(count('tech')).toBe(1);
		expect(new Set(slides.map((slide) => slide.key)).size).toBe(slides.length);
	});

	it('트러블슈팅 한 건은 채워진 단계 수만큼 빌드가 있다', () => {
		const slides = slidesOf(landingOf(sample)).filter(
			(slide) => slide.type === 'section' && slide.section.kind === 'troubleshooting'
		);
		// 예시의 셋째 건은 원인이 비어 있다
		expect(slides.map((slide) => slide.builds)).toEqual([4, 4, 3]);
	});

	it('빈 프로젝트는 표지와 마지막 인사 두 장이다', () => {
		const slides = slidesOf(landingOf({ ...blankProject('empty'), name: '빈 프로젝트' }));
		expect(slides.map((slide) => slide.type)).toEqual(['title', 'end']);
	});
});
