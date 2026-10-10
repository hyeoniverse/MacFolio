import { describe, expect, it, vi } from 'vitest';
import { activityStore, loadActivity, mergePushes, toActivity, toWeeks, type ActivityItem } from './githubActivityApi';

const item = (over: Partial<ActivityItem>): ActivityItem => ({
	id: '1',
	kind: 'push',
	repo: 'hyeoniverse/MacFolio',
	createdAt: '2026-10-03T10:00:00Z',
	url: 'https://github.com/hyeoniverse/MacFolio/commits/main',
	action: null,
	ref: 'main',
	refType: null,
	number: null,
	title: null,
	commits: 2,
	...over,
});

describe('toActivity', () => {
	it('달력의 단계는 0~4로 자르고, 모르는 종류나 GitHub 밖 주소의 활동은 버린다', () => {
		const data = toActivity({
			contributions: { total: 3, days: [{ date: '2026-10-01', count: 3, level: 7 }, { date: 'x' }] },
			events: [item({}), item({ id: '2', kind: 'unknown' as never }), item({ id: '3', url: 'javascript:alert(1)' })],
		});
		expect(data?.contributions).toEqual({ total: 3, days: [{ date: '2026-10-01', count: 3, level: 4 }] });
		expect(data?.events.map((event) => event.id)).toEqual(['1']);
	});

	it('달력이 없으면 활동만, 모양이 틀리면 null', () => {
		expect(toActivity({ contributions: null, events: [] })).toEqual({ contributions: null, events: [] });
		expect(toActivity({ events: 'x' })).toBeNull();
	});
});

describe('toWeeks', () => {
	it('일요일부터 시작하는 주로 묶고, 첫 주의 앞 칸은 비운다', () => {
		// 2026-10-01은 목요일
		const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((date) => ({ date, count: 0, level: 0 }));
		const weeks = toWeeks(days);
		expect(weeks).toHaveLength(2);
		expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
		expect(weeks[0][4]?.date).toBe('2026-10-01');
		expect(weeks[1][0]?.date).toBe('2026-10-04');
	});
});

describe('mergePushes', () => {
	it('같은 날 같은 저장소·브랜치의 푸시는 하나로 합쳐 커밋 수를 더한다', () => {
		const merged = mergePushes([
			item({ id: '1', commits: 2 }),
			item({ id: '2', commits: 3, createdAt: '2026-10-03T08:00:00Z' }),
			item({ id: '3', commits: 1, createdAt: '2026-10-02T08:00:00Z' }),
			item({ id: '4', kind: 'star', commits: null, createdAt: '2026-10-02T07:00:00Z' }),
		]);
		expect(merged.map((event) => [event.id, event.commits, event.pushes])).toEqual([
			['1', 5, 2],
			['3', 1, 1],
			['4', null, 1],
		]);
	});

	it('한쪽이라도 커밋 수를 모르면 합친 커밋 수도 모른다', () => {
		expect(mergePushes([item({ commits: 2 }), item({ id: '2', commits: null })])[0].commits).toBeNull();
	});
});

describe('loadActivity', () => {
	it('API 주소가 없으면 묻지 않고, 받으면 저장소에 둔다', async () => {
		const none = vi.fn();
		await loadActivity('', none as unknown as typeof fetch);
		expect(none).not.toHaveBeenCalled();

		const ok = vi.fn(async () => new Response(JSON.stringify({ contributions: null, events: [item({})] })));
		await loadActivity('http://api', ok as unknown as typeof fetch);
		expect(ok).toHaveBeenCalledWith('http://api/github/activity');
		expect(activityStore.getState().data?.events).toHaveLength(1);
	});
});
