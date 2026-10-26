import { describe, expect, it } from 'vitest';
import { EMPTY_NAV_HISTORY, NAV_HISTORY_LIMIT, stepList, stepTarget, visit, type NavEntry } from './navHistory';

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
