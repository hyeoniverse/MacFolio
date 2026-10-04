import { describe, expect, it } from 'vitest';
import { completePath, entries, nodeAt, resolve, treeLines, type RepoDir } from '@/apps/safari/project/terminalRepo';

const repo: RepoDir = {
	'README.md': '# 수강 목록',
	Week01: { '01': { 'Readme.md': '오리엔테이션' }, 'Readme.md': '1주차' },
	Week02: { '03': { 'login.js': 'console.log(1)', 'shot.png': null } },
	Projects: { 'Book-shop': {}, 'book-store': {} },
};

describe('terminalRepo', () => {
	it('경로를 따라간다: 상대, 절대(~·/), .., 대소문자 무시', () => {
		expect(resolve(repo, [], 'Week02/03')).toEqual(['Week02', '03']);
		expect(resolve(repo, ['Week02', '03'], '..')).toEqual(['Week02']);
		expect(resolve(repo, ['Week02'], '~/Week01')).toEqual(['Week01']);
		expect(resolve(repo, ['Week02'], '/')).toEqual([]);
		expect(resolve(repo, [], 'week01/readme.MD')).toEqual(['Week01', 'Readme.md']);
		expect(resolve(repo, [], 'Week09')).toBeNull();
		expect(resolve(repo, [], 'README.md/x')).toBeNull();
	});

	it('폴더를 먼저, 이름순으로 늘어놓고 그림 같은 파일은 null', () => {
		expect(entries(repo).map((entry) => entry.name)).toEqual(['Projects', 'Week01', 'Week02', 'README.md']);
		expect(nodeAt(repo, ['Week02', '03', 'shot.png'])).toBeNull();
	});

	it('tree는 정해진 깊이까지 가지를 그린다', () => {
		expect(treeLines(repo.Week01 as RepoDir, 2)).toEqual(['├── 01/', '│   └── Readme.md', '└── Readme.md']);
	});

	it('Tab: 하나만 맞으면 채우고(폴더는 /까지), 여럿이면 겹치는 앞부분까지', () => {
		expect(completePath(repo, [], 'Proj')).toBe('Projects/');
		expect(completePath(repo, [], 'Week02/0')).toBe('Week02/03/');
		expect(completePath(repo, [], 'We')).toBe('Week0');
		expect(completePath(repo, ['Projects'], 'b')).toBe('Book-s');
		expect(completePath(repo, [], 'zzz')).toBe('zzz');
	});
});
