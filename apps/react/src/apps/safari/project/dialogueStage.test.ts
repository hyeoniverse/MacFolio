import { describe, expect, it } from 'vitest';
import { blankProject, type Project } from '@macfolio/desktop-core/site';
import { GENERAL_SAMPLE } from '@/apps/settings/lookSamples';
import {
	battleHp,
	CHEST_CLOSED,
	CHEST_OPEN,
	hpLevel,
	mirror,
	MONSTERS,
	monsterColors,
	monsterOf,
	nextUnread,
	outlined,
	paginate,
	PERSON,
	periodDays,
	personColors,
	pixelRuns,
	platformRows,
	sceneOf,
	shorten,
	SPRITE_COLORS,
	splitScore,
	statusStats,
	textWidth,
	troubleKeys,
	windowAround,
	wrapText,
} from './dialogueStage';

const sample: Project = { ...structuredClone(GENERAL_SAMPLE), id: 'sample', url: 'https://github.com/me/sample' };

describe('칸 그림', () => {
	/** 줄 폭이 모두 같고 아는 글자만 쓰는지 */
	const expectGrid = (rows: readonly string[], width: number, height: number, known: Record<string, string>) => {
		expect(rows).toHaveLength(height);
		for (const row of rows) {
			expect(row).toHaveLength(width);
			for (const ch of row) expect(ch === '.' || ch in known).toBe(true);
		}
	};

	it('몬스터는 32×32, 상자는 20×16, 사람은 16×24 격자이고 아는 색 글자만 쓴다', () => {
		for (const rows of MONSTERS) expectGrid(rows, 32, 32, SPRITE_COLORS);
		expectGrid(CHEST_CLOSED, 20, 16, SPRITE_COLORS);
		expectGrid(CHEST_OPEN, 20, 16, SPRITE_COLORS);
		expectGrid(PERSON, 16, 24, personColors('누구'));
	});

	it('왼쪽 반을 접어 펼치면 좌우가 같다', () => {
		expect(mirror(['.WR'])).toEqual(['.WRRW.']);
		for (const rows of [...MONSTERS, CHEST_CLOSED, PERSON])
			for (const row of rows) expect([...row].reverse().join('')).toBe(row);
	});

	it('사람의 색은 이름으로 정해져 같은 이름은 늘 같고, 이름이 다르면 대개 다르다', () => {
		expect(personColors('김하늘')).toEqual(personColors('김하늘'));
		const looks = new Set(
			['김하늘', '이도윤', '박서연', '최민준', '정유나'].map((n) => JSON.stringify(personColors(n)))
		);
		expect(looks.size).toBeGreaterThan(3);
	});

	it('차례대로 돌려 쓰고, 이어진 같은 색은 사각형 하나로 묶는다', () => {
		expect(monsterOf(0)).toBe(MONSTERS[0]);
		expect(monsterOf(MONSTERS.length)).toBe(MONSTERS[0]);
		expect(pixelRuns(['.WW.R', 'YYYYY'])).toEqual([
			{ x: 1, y: 0, w: 2, color: SPRITE_COLORS.W },
			{ x: 4, y: 0, w: 1, color: SPRITE_COLORS.R },
			{ x: 0, y: 1, w: 5, color: SPRITE_COLORS.Y },
		]);
		// 다른 색표를 주면 그 색으로, 색표에 없는 글자는 빈칸
		expect(pixelRuns(['HQ'], { H: '#123456' })).toEqual([{ x: 0, y: 0, w: 1, color: '#123456' }]);
	});
});

describe('전투 HP', () => {
	it('첫 단계는 가득, 마지막 단계는 0, 그 사이는 줄어든다', () => {
		const all = ['problem', 'cause', 'solution', 'result'] as const;
		const hps = all.map((step) => battleHp(all, step));
		expect(hps).toEqual([100, 67, 33, 0]);
		expect(battleHp(['problem', 'solution'], 'solution')).toBe(0);
		expect(battleHp(['problem'], 'problem')).toBe(100);
		expect(battleHp(all, undefined)).toBe(100);
	});

	it('글이 있는 단계만 차례대로', () => {
		expect(troubleKeys({ title: 't', problem: '문제', cause: ' ', solution: '해결', result: '결과' })).toEqual([
			'problem',
			'solution',
			'result',
		]);
	});
});

describe('데이터에서 센 숫자', () => {
	it('기간의 날수는 첫날과 끝날을 모두 센다. 읽을 수 없으면 null', () => {
		expect(periodDays('2025.03.04 – 2025.06.27')).toBe(116);
		expect(periodDays('2024.06.10 – 2024.06.24')).toBe(15);
		expect(periodDays('Week 01–02')).toBeNull();
		expect(periodDays(undefined)).toBeNull();
	});

	it('상태 창 능력치는 있는 것만 이름 그대로', () => {
		expect(statusStats(sample)).toEqual([
			{ label: '맡은 일', value: '5가지' },
			{ label: '함께한 사람', value: '4명' },
			{ label: '쓴 기술', value: '8개' },
			{ label: '해결한 문제', value: '3건' },
			{ label: '만든 기간', value: '116일' },
		]);
		const empty: Project = { ...blankProject('empty'), name: '빈', url: 'https://github.com/me/empty' };
		expect(statusStats(empty)).toEqual([]);
	});

	it('점수는 앞말·숫자·뒷말로 나눈다', () => {
		expect(splitScore('1,800명')).toEqual({ lead: '', num: '1,800', tail: '명' });
		expect(splitScore('약 18분')).toEqual({ lead: '약 ', num: '18', tail: '분' });
		expect(splitScore('TOP 10')).toEqual({ lead: 'TOP ', num: '10', tail: '' });
		expect(splitScore('없음')).toBeNull();
	});
});

describe('목록 창', () => {
	it('지금 줄이 보이게 size개만 고른다', () => {
		expect(windowAround(3, 2, 5)).toEqual([0, 3]);
		expect(windowAround(10, 0, 4)).toEqual([0, 4]);
		expect(windowAround(10, 5, 4)).toEqual([4, 8]);
		expect(windowAround(10, 9, 4)).toEqual([6, 10]);
	});
});

describe('밝은 장면', () => {
	it('outlined는 가장자리에 한 칸씩 늘리고, 칠한 칸에 닿은 빈칸만 외곽선으로', () => {
		expect(outlined(['.W.'])).toEqual(['..X..', '.XWX.', '..X..']);
		const person = outlined(PERSON);
		expect(person).toHaveLength(PERSON.length + 2);
		for (const row of person) expect(row).toHaveLength(PERSON[0].length + 2);
		// 칠한 칸은 그대로, 바뀐 것은 빈칸뿐
		PERSON.forEach((row, y) => expect(person[y + 1].slice(1, -1).replace(/X/g, '.')).toBe(row));
	});

	it('발판은 납작한 흙 자리: 테두리 A가 둘레를 감싸고, 위 가장자리 풀 D, 밝은 흙 C, 흙 B, 그늘 E', () => {
		const rows = platformRows(40, 8);
		expect(rows).toHaveLength(8);
		for (const row of rows) expect(row).toMatch(/^[.ABCDE]{40}$/);
		// 모양(칠한 칸)은 좌우·위아래가 같고, 빛 때문에 색은 왼쪽 위가 밝다
		const shape = rows.map((row) => row.replace(/[^.]/g, '#'));
		for (const row of shape) expect(row).toBe([...row].reverse().join(''));
		expect(shape).toEqual([...shape].reverse());
		// 가운데 줄의 양 끝은 테두리, 모서리는 비어 있다
		expect(rows[4][0]).toBe('A');
		expect(rows[0][0]).toBe('.');
		const all = platformRows(60, 12).join('');
		for (const key of 'ABCDE') expect(all).toContain(key);
		// 위 가장자리 바로 아래는 풀
		expect(rows[1].slice(15, 25)).toMatch(/^D+$/);
	});

	it('몬스터마다 다른 몸 색, 모든 색 글자를 칠한다', () => {
		const bodies = MONSTERS.map((_, i) => monsterColors(i).W);
		expect(new Set(bodies).size).toBe(MONSTERS.length);
		expect(monsterColors(MONSTERS.length)).toBe(monsterColors(0));
		for (const [i, rows] of MONSTERS.entries())
			for (const ch of new Set(outlined(rows).join(''))) if (ch !== '.') expect(monsterColors(i)[ch], ch).toBeTruthy();
	});

	it('HP 막대 색: 반 넘게 초록, 5분의 1 넘게 노랑, 그 아래 빨강', () => {
		expect(hpLevel(100)).toBe('high');
		expect(hpLevel(67)).toBe('high');
		expect(hpLevel(50)).toBe('mid');
		expect(hpLevel(33)).toBe('mid');
		expect(hpLevel(20)).toBe('low');
		expect(hpLevel(0)).toBe('low');
	});

	it('주제마다 장면: 전투는 들판, 파티는 광장, 장은 풀밭, 그 밖은 해 질 녘', () => {
		expect(sceneOf('troubleshooting')).toBe('field');
		expect(sceneOf('team')).toBe('plaza');
		expect(sceneOf('specs')).toBe('shop');
		expect(sceneOf('contributions')).toBe('menu');
		expect(sceneOf('timeline')).toBe('map');
		expect(sceneOf('deployments')).toBe('cave');
		expect(sceneOf('facts')).toBe('arcade');
		expect(sceneOf('credits')).toBe('night');
		expect(sceneOf('highlights')).toBe('meadow');
		expect(sceneOf('chapter-2')).toBe('meadow');
		expect(sceneOf('links')).toBe('sunset');
		expect(sceneOf(undefined)).toBe('sunset');
	});
});

describe('대화 상자의 글 나누기', () => {
	it('글자 폭은 갈무리11 11px에서 한글 11칸, 빈칸 4.6칸으로 어림한다', () => {
		expect(textWidth('가나')).toBe(22);
		expect(textWidth('가 나')).toBeCloseTo(26.6);
		expect(textWidth('m')).toBeGreaterThan(textWidth('a'));
	});

	it('빈칸에서만 줄을 바꾸고, 한 줄보다 긴 낱말은 글자로 자른다', () => {
		expect(wrapText('가나다 라마바 사아자', 71)).toEqual(['가나다 라마바', '사아자']);
		expect(wrapText('가나다라마바사', 33)).toEqual(['가나다', '라마바', '사']);
		expect(wrapText('', 100)).toEqual(['']);
		for (const line of wrapText(GENERAL_SAMPLE.troubleshooting?.[0].solution ?? '', 318))
			expect(textWidth(line)).toBeLessThanOrEqual(318);
	});

	it('한 장은 두 줄까지: 문장은 되도록 한 장에 잇고, 긴 문장은 줄 단위로 나눈다', () => {
		const width = 318;
		expect(paginate('짧은 글입니다.', width)).toEqual(['짧은 글입니다.']);
		expect(paginate('', width)).toEqual(['']);
		const long = Array.from({ length: 6 }, (_, i) => `${i + 1}번째 문장은 대화 상자 한 줄쯤 되는 긴 문장입니다.`).join(
			' '
		);
		const pages = paginate(long, width);
		expect(pages.length).toBeGreaterThan(2);
		for (const page of pages) expect(wrapText(page, width).length).toBeLessThanOrEqual(2);
		// 글자는 빠지거나 늘지 않는다
		expect(pages.join(' ').replace(/\s+/g, ' ')).toBe(long);
		const one =
			'빈칸이 하나도 없는 아주 긴 한 문장이 두 줄을 넘어가면 줄 단위로 끊어서 여러 장으로 넘겨야 합니다 그래야 상자가 커지지 않습니다';
		for (const page of paginate(one, 120)) expect(wrapText(page, 120).length).toBeLessThanOrEqual(2);
	});

	it('이름은 max자보다 길면 줄임표', () => {
		expect(shorten('트러블슈팅', 12)).toBe('트러블슈팅');
		expect(shorten('가나다라마바', 4)).toBe('가나다…');
	});
});

describe('메뉴의 다음 차례(NEXT)', () => {
	const list = [{ id: 'a' }, { id: 'b' }, { id: 'links' }, { id: 'c' }];
	const skip = new Set(['links']);
	it('여정 차례대로 아직 안 읽은 첫 주제, 셀 수 없는 줄은 건너뛴다', () => {
		expect(nextUnread(list, new Set(), undefined, skip)?.id).toBe('a');
		expect(nextUnread(list, new Set(['a']), undefined, skip)?.id).toBe('b');
		expect(nextUnread(list, new Set(['a', 'b']), undefined, skip)?.id).toBe('c');
		expect(nextUnread(list, new Set(['a', 'b', 'c']), undefined, skip)).toBeUndefined();
	});

	it('after를 주면 그 다음부터 돌아 찾는다', () => {
		expect(nextUnread(list, new Set(['b']), 'b', skip)?.id).toBe('c');
		expect(nextUnread(list, new Set(['c']), 'c', skip)?.id).toBe('a');
	});
});
