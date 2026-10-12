import type React from 'react';
import { describe, expect, it } from 'vitest';
import { devtoolAccent } from './accent';
import { cloneCommand, commitHash, contributionGraph, featureDiff, parseDate, parseTree } from './code';

describe('commitHash', () => {
	it('같은 제목이면 같은 일곱 자리 16진수다', () => {
		expect(commitHash('낙관적 업데이트')).toMatch(/^[0-9a-f]{7}$/);
		expect(commitHash('낙관적 업데이트')).toBe(commitHash('낙관적 업데이트'));
		expect(commitHash('낙관적 업데이트')).not.toBe(commitHash('접근성 점검'));
	});
});

describe('cloneCommand', () => {
	it('GitHub 저장소 주소에 .git을 붙이고, 다른 주소는 그대로 둔다', () => {
		expect(cloneCommand('https://github.com/hyeoniverse/QRU')).toBe('git clone https://github.com/hyeoniverse/QRU.git');
		expect(cloneCommand('https://github.com/a/b.git/')).toBe('git clone https://github.com/a/b.git');
		expect(cloneCommand('https://gitlab.com/a/b')).toBe('git clone https://gitlab.com/a/b');
	});
});

describe('parseTree', () => {
	const tree = `bookclub/
├── web/              # React 화면
│   ├── features/     # 모임, 토론
│   └── shared/
├── server
│   └── progress/     # 진도별 글 가리기
└── docker-compose.yml`;

	it('그림 글자의 너비로 깊이를, # 뒤로 설명을 읽는다', () => {
		const rows = parseTree(tree);
		expect(rows.map((row) => [row.depth, row.name])).toEqual([
			[0, 'bookclub/'],
			[1, 'web/'],
			[2, 'features/'],
			[2, 'shared/'],
			[1, 'server'],
			[2, 'progress/'],
			[1, 'docker-compose.yml'],
		]);
		expect(rows[1].note).toBe('React 화면');
		expect(rows[3].note).toBeUndefined();
	});

	it('슬래시로 끝나거나 아래에 더 깊은 줄이 있으면 폴더다', () => {
		const rows = parseTree(tree);
		expect(rows.find((row) => row.name === 'server')?.folder).toBe(true);
		expect(rows.find((row) => row.name === 'docker-compose.yml')?.folder).toBe(false);
	});
});

describe('contributionGraph', () => {
	const entries = [
		{ date: '2025.03.04', label: '시작' },
		{ date: '2025.04.22', label: '중간' },
		{ date: '2025.06.27', label: '발표' },
	];

	it('날짜를 읽는다', () => {
		expect(parseDate('2025.03.04')?.toISOString().slice(0, 10)).toBe('2025-03-04');
		expect(parseDate('2025-06')?.toISOString().slice(0, 10)).toBe('2025-06-01');
		expect(parseDate('언젠가')).toBeNull();
	});

	it('주마다 일곱 칸이고 걸음이 있는 날은 가장 진하다', () => {
		const graph = contributionGraph(entries);
		expect(graph).not.toBeNull();
		expect(graph!.weeks.length).toBeGreaterThanOrEqual(20);
		expect(graph!.weeks.every((week) => week.length === 7)).toBe(true);
		const cells = graph!.weeks.flat();
		for (const date of ['2025-03-04', '2025-04-22', '2025-06-27'])
			expect(cells.find((cell) => cell.date === date)).toMatchObject({ level: 4, milestone: true });
		expect(graph!.months[0].label).toMatch(/월$/);
	});

	it('같은 날짜면 언제나 같은 그래프다', () => {
		expect(contributionGraph(entries)).toEqual(contributionGraph(entries));
	});

	it('날짜를 하나도 못 읽으면 그래프가 없다', () => {
		expect(contributionGraph([{ date: '처음', label: '시작' }])).toBeNull();
	});
});

describe('featureDiff', () => {
	it('제목과 설명을 담은 더한 줄이 있다', () => {
		const lines = featureDiff({ title: '함께 정하는 일정', body: '날짜를 정합니다.' }, 2);
		expect(lines[0].sign).toBe('@');
		expect(lines.some((line) => line.sign === '+' && line.text.includes('함께 정하는 일정'))).toBe(true);
		expect(lines.some((line) => line.text.includes('feature03'))).toBe(true);
	});
});

describe('devtoolAccent', () => {
	const vars = (hue: number) => ({ '--lk-accent': `hsl(${hue} 80% 40%)` }) as React.CSSProperties;
	it('맑은 색은 그대로, 노랑에서 연두까지는 기본 파랑으로 돌린다', () => {
		expect(devtoolAccent(vars(210))).toEqual(vars(210));
		expect(devtoolAccent(vars(50))).toEqual({});
		expect(devtoolAccent({})).toEqual({});
	});
});
