import { describe, expect, it } from 'vitest';
import { blankProject, type Project } from '@macfolio/desktop-core/site';
import { GENERAL_SAMPLE } from '@/apps/settings/lookSamples';
import {
	battleHp,
	CHEST_CLOSED,
	CHEST_OPEN,
	letterOf,
	MONSTER_COLORS,
	MONSTERS,
	monsterOf,
	periodDays,
	pixelRuns,
	rowsFor,
	slotIcon,
	splitScore,
	statusStats,
	techIcon,
	troubleKeys,
	windowAround,
} from './dialogueStage';

const sample: Project = { ...structuredClone(GENERAL_SAMPLE), id: 'sample', url: 'https://github.com/me/sample' };

describe('techIcon', () => {
	it('아는 기술은 버전과 괄호를 떼고 브랜드 아이콘으로', () => {
		expect(techIcon('React')).toBe('fa-react');
		expect(techIcon('React 19')).toBe('fa-react');
		expect(techIcon('Unity 6')).toBe('fa-unity');
		expect(techIcon('Node.js')).toBe('fa-node-js');
		expect(techIcon('Docker')).toBe('fa-docker');
		expect(techIcon('Python (FastAPI)')).toBe('fa-python');
		expect(techIcon('GitHub Actions')).toBe('fa-github');
	});

	it('모르는 기술(FA에 아이콘이 없는 것 포함)은 null: 첫 글자 칸으로 그린다', () => {
		expect(techIcon('TypeScript')).toBeNull();
		expect(techIcon('Redis')).toBeNull();
		expect(techIcon('Next.js')).toBeNull();
		expect(techIcon('')).toBeNull();
		expect(letterOf('zustand')).toBe('Z');
		expect(letterOf('갈무리')).toBe('갈');
	});

	it('사양 칸: 값의 첫 기술이 아는 것이면 브랜드, 아니면 분류 이름으로', () => {
		expect(slotIcon('화면', 'React 19, TypeScript, Vite')).toEqual({ brand: true, icon: 'fa-react' });
		expect(slotIcon('서버', 'Vercel 서버리스 함수, Redis')).toEqual({ brand: false, icon: 'fa-server' });
		expect(slotIcon('인증', '이메일 로그인')).toEqual({ brand: false, icon: 'fa-key' });
		expect(slotIcon('기타', '무엇')).toEqual({ brand: false, icon: 'fa-cube' });
	});
});

describe('칸 그림', () => {
	it('몬스터와 상자는 모두 같은 폭의 줄이고, 아는 색 글자만 쓴다', () => {
		for (const rows of [...MONSTERS, CHEST_CLOSED, CHEST_OPEN]) {
			const width = rows[0].length;
			expect(width).toBe(16);
			for (const row of rows) {
				expect(row).toHaveLength(width);
				for (const ch of row) expect(ch === '.' || ch in MONSTER_COLORS).toBe(true);
			}
		}
		expect(MONSTERS.every((rows) => rows.length === 16)).toBe(true);
	});

	it('차례대로 돌려 쓰고, 이어진 같은 색은 사각형 하나로 묶는다', () => {
		expect(monsterOf(0)).toBe(MONSTERS[0]);
		expect(monsterOf(MONSTERS.length)).toBe(MONSTERS[0]);
		expect(pixelRuns(['.WW.R', 'YYYYY'])).toEqual([
			{ x: 1, y: 0, w: 2, color: MONSTER_COLORS.W },
			{ x: 4, y: 0, w: 1, color: MONSTER_COLORS.R },
			{ x: 0, y: 1, w: 5, color: MONSTER_COLORS.Y },
		]);
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

	it('무대 높이에 들어가는 줄 수 (적어도 한 줄, 많아야 max)', () => {
		expect(rowsFor(undefined, 32, 76, 7)).toBe(7);
		expect(rowsFor(255, 32, 76, 7)).toBe(5);
		expect(rowsFor(80, 32, 76, 7)).toBe(1);
		expect(rowsFor(2000, 32, 76, 7)).toBe(7);
	});
});
