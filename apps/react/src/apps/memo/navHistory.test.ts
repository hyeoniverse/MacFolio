import { describe, expect, it } from 'vitest';
import {
	EMPTY_NAV_HISTORY,
	NAV_HISTORY_LIMIT,
	NAV_HISTORY_VERSION,
	parseNavHistory,
	pruneNavHistory,
	serializeNavHistory,
	stepList,
	stepTarget,
	visit,
	type NavEntry,
} from './navHistory';

const entry = (slug: string | null, category = '모든 글'): NavEntry => ({ category, tags: '', slug });
const all = () => true;

describe('메모 뒤로·앞으로 기록', () => {
	it('본 칸을 차례로 쌓고, 지금 칸과 같으면 쌓지 않는다', () => {
		let history = visit(EMPTY_NAV_HISTORY, entry('a'));
		history = visit(history, entry('a'));
		history = visit(history, entry('b'));
		expect(history.entries.map((item) => item.slug)).toEqual(['a', 'b']);
		expect(history.index).toBe(1);
	});

	it('뒤로 간 뒤 새 칸을 열면 앞으로 갈 기록은 버린다', () => {
		let history = [entry('a'), entry('b'), entry('c')].reduce(visit, EMPTY_NAV_HISTORY);
		history = { ...history, index: 0 };
		history = visit(history, entry('d'));
		expect(history.entries.map((item) => item.slug)).toEqual(['a', 'd']);
	});

	it(`${NAV_HISTORY_LIMIT}칸을 넘으면 오래된 칸부터 버린다`, () => {
		const history = Array.from({ length: NAV_HISTORY_LIMIT + 5 }, (_, i) => entry(`p${i}`)).reduce(
			visit,
			EMPTY_NAV_HISTORY
		);
		expect(history.entries).toHaveLength(NAV_HISTORY_LIMIT);
		expect(history.entries[0].slug).toBe('p5');
		expect(history.index).toBe(NAV_HISTORY_LIMIT - 1);
	});

	it('갈 수 없는 칸(지운 글)은 건너뛰고, 목록은 가까운 칸부터', () => {
		const history = [entry('a'), entry('gone'), entry('b'), entry('c')].reduce(visit, EMPTY_NAV_HISTORY);
		const usable = (item: NavEntry) => item.slug !== 'gone';
		expect(stepTarget(history, -1, usable)).toBe(2);
		expect(stepTarget({ ...history, index: 2 }, -1, usable)).toBe(0);
		expect(stepTarget(history, 1, all)).toBeNull();
		expect(stepList(history, -1, usable).map(({ entry }) => entry.slug)).toEqual(['b', 'a']);
		expect(stepList({ ...history, index: 0 }, 1, usable).map(({ index }) => index)).toEqual([2, 3]);
	});

	it('폴더만 바뀌어도 다른 칸이다', () => {
		const history = [entry('a', '모든 글'), entry('a', '기술 노트')].reduce(visit, EMPTY_NAV_HISTORY);
		expect(history.entries).toHaveLength(2);
	});

	it('같은 폴더의 글 없는 칸은 글이 열리면 그 칸을 바꾼다 (불러오기 전의 빈 칸이 남지 않게)', () => {
		const history = [entry(null), entry('a'), entry(null, '기술 노트'), entry('b', '기술 노트')].reduce(
			visit,
			EMPTY_NAV_HISTORY
		);
		expect(history.entries).toEqual([entry('a'), entry('b', '기술 노트')]);
	});
});

describe('기록 저장과 복원 (sessionStorage)', () => {
	const saved = [entry('a'), entry('b'), entry('c')].reduce(visit, EMPTY_NAV_HISTORY);

	it('저장한 모양을 그대로 다시 읽는다 (JSON을 거쳐도)', () => {
		const raw = JSON.parse(JSON.stringify(serializeNavHistory({ ...saved, index: 1 })));
		expect(parseNavHistory(raw)).toEqual({ entries: saved.entries, index: 1 });
	});

	it('버전이 다르거나 모양이 틀리면 버린다', () => {
		const good = serializeNavHistory(saved);
		for (const bad of [
			null,
			'x',
			{ ...good, v: NAV_HISTORY_VERSION + 1 },
			{ ...good, index: 1.5 },
			{ ...good, entries: [{ category: 1, tags: '', slug: null }] },
			{ ...good, entries: [{ category: '모든 글', tags: '', slug: 3 }] },
			{ ...good, entries: 'a' },
		])
			expect(parseNavHistory(bad)).toEqual(EMPTY_NAV_HISTORY);
	});

	it('상한을 넘는 기록은 오래된 칸부터 버리고, 지금 칸은 범위 안으로', () => {
		const entries = Array.from({ length: NAV_HISTORY_LIMIT + 10 }, (_, i) => entry(`p${i}`));
		const parsed = parseNavHistory({ v: NAV_HISTORY_VERSION, index: 999, entries });
		expect(parsed.entries).toHaveLength(NAV_HISTORY_LIMIT);
		expect(parsed.entries[0].slug).toBe('p10');
		expect(parsed.index).toBe(NAV_HISTORY_LIMIT - 1);
		expect(parseNavHistory({ v: NAV_HISTORY_VERSION, index: -5, entries: [entry('a')] }).index).toBe(0);
	});

	it('갈 수 없게 된 칸을 빼고 지금 칸을 맞추며, 이웃하게 된 같은 칸은 합친다', () => {
		const history = [entry('a'), entry('gone'), entry('a'), entry('b'), entry('gone2'), entry('c')].reduce(
			visit,
			EMPTY_NAV_HISTORY
		);
		const usable = (item: NavEntry) => !item.slug?.startsWith('gone');
		// 지금 칸(c)은 남는다
		expect(pruneNavHistory(history, usable)).toEqual({ entries: [entry('a'), entry('b'), entry('c')], index: 2 });
		// 지금 칸이 빠지면 앞의 가장 가까운 칸으로
		expect(pruneNavHistory({ ...history, index: 4 }, usable).index).toBe(1);
		// 앞에 남은 칸이 없으면 뒤의 첫 칸
		expect(pruneNavHistory({ entries: [entry('gone'), entry('b')], index: 0 }, usable)).toEqual({
			entries: [entry('b')],
			index: 0,
		});
		expect(pruneNavHistory({ entries: [entry('gone')], index: 0 }, usable)).toEqual(EMPTY_NAV_HISTORY);
	});
});
