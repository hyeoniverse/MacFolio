import { describe, expect, it } from 'vitest';
import { MAX_ACTIVITY, parseContributions, toActivities, toActivity } from './activity.js';
import { contributionsHtml, pushEvent } from './github-api.fake.js';

describe('parseContributions', () => {
	it('날짜 칸의 단계와 설명의 기여 수를 읽고, 날짜 순서로 둔다', () => {
		const html = contributionsHtml(
			[
				{ date: '2026-09-29', level: 4, count: 12 },
				{ date: '2026-09-27', level: 0, count: 0 },
				{ date: '2026-09-28', level: 1, count: 1 },
			],
			1234
		);
		expect(parseContributions(html)).toEqual({
			total: 1234,
			days: [
				{ date: '2026-09-27', level: 0, count: 0 },
				{ date: '2026-09-28', level: 1, count: 1 },
				{ date: '2026-09-29', level: 4, count: 12 },
			],
		});
	});

	it('합계 문구가 없으면 날짜의 기여 수를 더한다', () => {
		const html = contributionsHtml([{ date: '2026-01-01', level: 2, count: 5 }]).replace(/<h2[\s\S]*?<\/h2>/, '');
		expect(parseContributions(html)?.total).toBe(5);
	});

	it('속성 순서가 바뀌어도 읽고, 단계는 0~4로 자른다', () => {
		const html =
			'<td data-level="9" id="d1" data-date="2026-02-02"></td><tool-tip for="d1">2 contributions on Feb 2</tool-tip>';
		expect(parseContributions(html)?.days).toEqual([{ date: '2026-02-02', level: 4, count: 2 }]);
	});

	it('달력 모양이 없으면 null', () => {
		expect(parseContributions('<html><body>Not Found</body></html>')).toBeNull();
	});
});

describe('toActivity', () => {
	it('푸시: 브랜치, 커밋 수, 마지막 커밋 메시지 첫 줄, 커밋 목록 주소', () => {
		expect(toActivity(pushEvent('1', 'hyeoniverse/MacFolio', '2026-10-03T10:00:00Z', 3))).toMatchObject({
			kind: 'push',
			repo: 'hyeoniverse/MacFolio',
			ref: 'main',
			commits: 3,
			title: '커밋 3',
			url: 'https://github.com/hyeoniverse/MacFolio/commits/main',
		});
	});

	it('푸시에 커밋 정보가 없으면 커밋 수는 null', () => {
		const event = { ...pushEvent('1', 'a/b', '2026-10-03T10:00:00Z'), payload: { ref: 'refs/heads/dev' } };
		expect(toActivity(event)).toMatchObject({ kind: 'push', ref: 'dev', commits: null, title: null });
	});

	it('닫힌 PR 가운데 합친 것은 merged, 주소는 GitHub 주소만', () => {
		const event = (merged: boolean, url: string) => ({
			id: '9',
			type: 'PullRequestEvent',
			created_at: '2026-10-02T09:00:00Z',
			repo: { name: 'a/b' },
			payload: { action: 'closed', pull_request: { number: 7, title: '제목', merged, html_url: url } },
		});
		expect(toActivity(event(true, 'https://github.com/a/b/pull/7'))).toMatchObject({
			kind: 'pull',
			action: 'merged',
			number: 7,
			title: '제목',
			url: 'https://github.com/a/b/pull/7',
		});
		expect(toActivity(event(false, 'javascript:alert(1)'))).toMatchObject({
			action: 'closed',
			url: 'https://github.com/a/b',
		});
	});

	it('저장소·브랜치 만들기, 릴리스, 별, 포크, 공개', () => {
		const base = { id: '1', created_at: '2026-10-01T00:00:00Z', repo: { name: 'a/b' } };
		expect(toActivity({ ...base, type: 'CreateEvent', payload: { ref_type: 'branch', ref: 'feat/x' } })).toMatchObject({
			kind: 'create',
			refType: 'branch',
			ref: 'feat/x',
			url: 'https://github.com/a/b/tree/feat%2Fx',
		});
		expect(
			toActivity({
				...base,
				type: 'ReleaseEvent',
				payload: { release: { tag_name: 'v1.0.0', name: '', html_url: 'https://github.com/a/b/releases/v1' } },
			})
		).toMatchObject({ kind: 'release', ref: 'v1.0.0', title: 'v1.0.0' });
		expect(toActivity({ ...base, type: 'WatchEvent', payload: { action: 'started' } })?.kind).toBe('star');
		expect(
			toActivity({
				...base,
				type: 'ForkEvent',
				payload: { forkee: { full_name: 'me/b', html_url: 'https://github.com/me/b' } },
			})
		).toMatchObject({ kind: 'fork', ref: 'me/b', url: 'https://github.com/me/b' });
		expect(toActivity({ ...base, type: 'PublicEvent' })?.kind).toBe('public');
	});

	it('보여 주지 않는 종류, 비공개, 모양이 틀린 이벤트는 null', () => {
		expect(toActivity({ id: '1', type: 'MemberEvent', created_at: 'x', repo: { name: 'a/b' } })).toBeNull();
		expect(toActivity({ ...pushEvent('1', 'a/b', 'x'), public: false })).toBeNull();
		expect(toActivity({ type: 'PushEvent' })).toBeNull();
	});
});

describe('toActivities', () => {
	it('최근 것부터, 정해 둔 수까지', () => {
		const events = Array.from({ length: MAX_ACTIVITY + 5 }, (_, i) =>
			pushEvent(String(i), 'a/b', `2026-10-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`)
		);
		const items = toActivities(events);
		expect(items).toHaveLength(MAX_ACTIVITY);
		expect(items[0].createdAt >= items[items.length - 1].createdAt).toBe(true);
	});
});
