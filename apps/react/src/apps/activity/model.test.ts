import { describe, expect, it } from 'vitest';
import {
	buildUtmUrl,
	change,
	eventLabel,
	formatDuration,
	groupSearchRows,
	kstToday,
	labelOf,
	memoSlugOf,
	periodRange,
	searchPageLabel,
	utmLabel,
	visitsByIp,
} from './model';

describe('활동 상태 보기의 값 바꾸기', () => {
	it('기간은 오늘(한국 시간)까지', () => {
		expect(kstToday(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07');
		expect(periodRange('today', '2026-10-07')).toEqual({ from: '2026-10-07', to: '2026-10-07' });
		expect(periodRange('7d', '2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-07' });
		expect(periodRange('30d', '2026-03-01')).toEqual({ from: '2026-01-31', to: '2026-03-01' });
	});

	it('앞 기간과 비교: 앞 기간이 없으면 비교하지 않는다', () => {
		expect(change(112, 100)).toEqual({ text: '+12%', direction: 'up' });
		expect(change(95, 100)).toEqual({ text: '-5%', direction: 'down' });
		expect(change(100, 100)).toEqual({ text: '0%', direction: 'same' });
		expect(change(5, 0)).toBeNull();
		expect(change(null, 3)).toBeNull();
	});

	it('머문 시간', () => {
		expect(formatDuration(161)).toBe('2분 41초');
		expect(formatDuration(42)).toBe('42초');
		expect(formatDuration(null)).toBe('–');
	});

	it('표의 이름: 앱 이름, 나라 이름, 빈 값', () => {
		expect(labelOf('app', 'memo')).toBe('메모');
		expect(labelOf('item', 'memo/hello')).toBe('메모 › hello');
		expect(labelOf('country', 'KR')).toBe('대한민국 (KR)');
		expect(labelOf('device', 'mobile')).toBe('모바일');
		expect(labelOf('referrer', '')).toBe('직접 들어옴');
		expect(labelOf('browser', '')).toBe('알 수 없음');
	});

	it('실시간 흐름의 한 줄', () => {
		const at = '2026-10-07T00:00:00Z';
		expect(eventLabel({ type: 'visit', app: null, item: null, at })).toBe('들어옴');
		expect(eventLabel({ type: 'app', app: 'safari', item: null, at })).toBe('Safari 열기');
		expect(eventLabel({ type: 'item', app: 'memo', item: 'hello', at })).toBe('메모 › hello 보기');
		expect(eventLabel({ type: 'link', app: null, item: 'github.com/hyeoniverse', at })).toBe(
			'github.com/hyeoniverse 누름'
		);
	});
});

describe('utm (#211)', () => {
	const empty = { source: '', medium: '', campaign: '', term: '', content: '' };
	const origin = 'https://macfolio.hyeoniverse.com';

	it('조합 표의 이름은 출처 / 매체 / 캠페인, 빈 칸은 -', () => {
		expect(utmLabel('linkedin / social / resume-2026')).toBe('linkedin / social / resume-2026');
		expect(utmLabel('velog /  / ')).toBe('velog / - / -');
		expect(labelOf('utm', ' / email / ')).toBe('- / email / -');
	});

	it('링크 생성기: 값은 소문자·공백은 -로 다듬고 빈 칸은 붙이지 않는다', () => {
		expect(buildUtmUrl('/', { ...empty, source: 'LinkedIn', medium: 'social', campaign: 'Resume 2026' }, origin)).toBe(
			`${origin}/?utm_source=linkedin&utm_medium=social&utm_campaign=resume-2026`
		);
		expect(buildUtmUrl('/memo/branded-ids', { ...empty, source: 'velog', term: 'Front End' }, origin)).toBe(
			`${origin}/memo/branded-ids?utm_source=velog&utm_term=front-end`
		);
	});

	it('링크 생성기: 다른 쿼리는 두고, 있던 utm은 바꾼다. 전체 주소도 받는다. http가 아니면 null', () => {
		expect(buildUtmUrl(`${origin}/memo/a?q=1&utm_source=old#h`, { ...empty, source: 'github' }, origin)).toBe(
			`${origin}/memo/a?q=1&utm_source=github#h`
		);
		expect(buildUtmUrl('', { ...empty, campaign: 'x' }, origin)).toBe(`${origin}/?utm_campaign=x`);
		expect(buildUtmUrl('javascript:alert(1)', empty, origin)).toBeNull();
	});
});

describe('Search Console 검색어', () => {
	const rows = [
		{ query: 'macfolio', page: 'https://example.com/', clicks: 3, impressions: 10, position: 2 },
		{ query: 'macfolio', page: 'https://example.com/memo/a', clicks: 1, impressions: 30, position: 4 },
		{ query: '포트폴리오', page: 'https://example.com/', clicks: 0, impressions: 5, position: 9 },
	];

	it('검색어로 묶으면 클릭·노출을 더하고 순위는 노출로 가중해 평균한다. 노출 많은 순', () => {
		expect(groupSearchRows(rows, 'query')).toEqual([
			{ key: 'macfolio', clicks: 4, impressions: 40, position: 3.5 },
			{ key: '포트폴리오', clicks: 0, impressions: 5, position: 9 },
		]);
	});

	it('페이지로 묶고, 페이지 하나의 검색어만 볼 수 있다', () => {
		expect(groupSearchRows(rows, 'page').map(({ key, impressions }) => [key, impressions])).toEqual([
			['https://example.com/memo/a', 30],
			['https://example.com/', 15],
		]);
		expect(groupSearchRows(rows, 'query', 'https://example.com/').map(({ key }) => key)).toEqual([
			'macfolio',
			'포트폴리오',
		]);
	});

	it('페이지 이름: https://와 끝의 /를 떼고, 블로그 글이면 글 주소를 안다', () => {
		expect(searchPageLabel('https://example.com/')).toBe('example.com');
		expect(searchPageLabel('https://example.com/memo/a')).toBe('example.com/memo/a');
		expect(memoSlugOf('https://example.com/memo/%ED%95%9C%EA%B8%80')).toBe('한글');
		expect(memoSlugOf('https://example.com/safari/x')).toBeNull();
		expect(memoSlugOf('not a url')).toBeNull();
	});
});

describe('실시간 IP', () => {
	it('가린 IP마다 방문 수를 많은 순으로, IP가 지워진 방문은 빈 키', () => {
		const visit = (ip: string | null) => ({ ip }) as Parameters<typeof visitsByIp>[0][number];
		expect(visitsByIp([visit('198.51.100.x'), visit('203.0.113.x'), visit(null), visit('203.0.113.x')])).toEqual([
			{ key: '203.0.113.x', value: 2 },
			{ key: '198.51.100.x', value: 1 },
			{ key: '', value: 1 },
		]);
	});
});
