import { describe, expect, it } from 'vitest';
import {
	ADMIN_ONLY_BREAKDOWNS,
	AppViews,
	BREAKDOWNS,
	cleanUtm,
	EventBatch,
	MAX_EVENTS,
	splitUtmKey,
	Summary,
	Totals,
	utmKey,
} from './analytics.js';
import { parse } from './parse.js';

describe('이벤트 묶음 검사', () => {
	const batch = { visitId: 'v-1a2b3c4d', events: [{ type: 'visit', referrer: 'GitHub.com', device: 'desktop' }] };

	it('sendBeacon의 text/plain(JSON 글자)과 JSON 객체를 모두 받는다. 호스트는 소문자로', () => {
		for (const input of [batch, JSON.stringify(batch)]) {
			expect(parse(EventBatch, input)).toEqual({
				value: { visitId: 'v-1a2b3c4d', events: [{ type: 'visit', referrer: 'github.com', device: 'desktop' }] },
			});
		}
	});

	it('빈 글자는 없는 것으로, 모르는 필드는 버린다 (DB 열과 같은 모양으로)', () => {
		expect(
			parse(EventBatch, { visitId: 'v-1a2b3c4d', events: [{ type: 'app', app: 'memo', item: '', hack: 1 }] })
		).toEqual({
			value: { visitId: 'v-1a2b3c4d', events: [{ type: 'app', app: 'memo' }] },
		});
	});

	it('하나라도 틀리면 전부 거절한다', () => {
		const wrong = (events: unknown[], visitId = 'v-1a2b3c4d') => 'errors' in parse(EventBatch, { visitId, events });
		expect(parse(EventBatch, 'not json')).toEqual({ errors: ['본문이 없습니다.'] });
		expect(parse(EventBatch, null)).toEqual({ errors: ['본문이 없습니다.'] });
		expect(parse(EventBatch, { visitId: 'short', events: [{ type: 'visit' }] })).toEqual({
			errors: ['visitId가 올바르지 않습니다.'],
		});
		expect(parse(EventBatch, { visitId: 'v-1a2b3c4d', events: [] })).toEqual({
			errors: [`events는 1~${MAX_EVENTS}개입니다.`],
		});
		expect(wrong(Array.from({ length: MAX_EVENTS + 1 }, () => ({ type: 'visit' })))).toBe(true);
		expect(wrong([{ type: 'visit' }, { type: 'hack' }])).toBe(true);
		expect(wrong([{ type: 'app', app: 'Memo App' }])).toBe(true);
		// 들어온 곳은 호스트만: 경로·검색어를 받지 않는다
		expect(wrong([{ type: 'visit', referrer: 'https://google.com/search?q=me' }])).toBe(true);
		expect(wrong([{ type: 'visit', device: 'tablet' }])).toBe(true);
		expect(wrong([{ type: 'leave', duration: -1 }])).toBe(true);
		expect(wrong([{ type: 'leave', duration: 1.5 }])).toBe(true);
		expect(wrong([{ type: 'item', app: 'memo', item: 'x'.repeat(201) }])).toBe(true);
	});
});

describe('응답 모양', () => {
	it('요약은 표 열여섯 개를 모두 가진다', () => {
		const totals = { visits: 1, visitors: 1, appOpens: 0, avgDurationSec: null };
		expect(parse(Totals, totals)).toEqual({ value: totals });
		const summary = {
			scope: 'public',
			from: '2026-10-01',
			to: '2026-10-11',
			days: [{ day: '2026-10-11', visits: 1, visitors: 1 }],
			totals,
			previous: totals,
			breakdown: {
				referrerGroup: [{ key: '직접', value: 1 }],
				referrer: [],
				source: [],
				medium: [],
				campaign: [],
				utm: [],
				term: [],
				content: [],
				app: [],
				item: [],
				link: [],
				country: [],
				device: [],
				browser: [],
				os: [],
				language: [],
			},
		};
		expect(parse(Summary, summary)).toEqual({ value: summary });
		expect(parse(Summary, { ...summary, breakdown: { referrerGroup: [] } })).toHaveProperty('errors');
		expect(parse(AppViews, { app: 'memo', views: { 'my-post': 3 } })).toEqual({
			value: { app: 'memo', views: { 'my-post': 3 } },
		});
	});
});

describe('utm 다듬기 (#211)', () => {
	it('소문자로, 앞뒤 공백은 빼고 이어진 공백은 - 하나로, 100자까지. 비면 undefined', () => {
		expect(cleanUtm('  LinkedIn ')).toBe('linkedin');
		expect(cleanUtm('Resume  2026\tKR')).toBe('resume-2026-kr');
		expect(cleanUtm('a'.repeat(150))).toHaveLength(100);
		expect(cleanUtm('   ')).toBeUndefined();
		expect(cleanUtm(null)).toBeUndefined();
	});

	it('받는 쪽(EventInput)도 같은 규칙으로 다듬는다. term·content도 받는다', () => {
		const parsed = parse(EventBatch, {
			visitId: 'v-1a2b3c4d',
			events: [{ type: 'visit', utmSource: 'LinkedIn', utmMedium: 'Social', utmTerm: 'Front End', utmContent: 'Top' }],
		});
		expect(parsed).toEqual({
			value: {
				visitId: 'v-1a2b3c4d',
				events: [
					{ type: 'visit', utmSource: 'linkedin', utmMedium: 'social', utmTerm: 'front-end', utmContent: 'top' },
				],
			},
		});
	});

	it('조합 키는 출처·매체·캠페인을  / 으로 묶고 되돌린다', () => {
		expect(utmKey('linkedin', undefined, 'resume-2026')).toBe('linkedin /  / resume-2026');
		expect(splitUtmKey('linkedin /  / resume-2026')).toEqual(['linkedin', '', 'resume-2026']);
	});

	it('조합·매체·term·content는 관리자 전용 표다', () => {
		for (const metric of ['medium', 'utm', 'term', 'content'] as const) {
			expect(BREAKDOWNS).toContain(metric);
			expect(ADMIN_ONLY_BREAKDOWNS).toContain(metric);
		}
	});
});
