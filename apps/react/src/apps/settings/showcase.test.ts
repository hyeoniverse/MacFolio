import { describe, expect, it } from 'vitest';
import type { RepoCard } from '@/apps/github/githubProfile';
import { groupByOwner, move, sameRepo } from './showcase';

const repo = (fullName: string) => {
	const [owner, name] = fullName.split('/');
	return { fullName, owner, name } as RepoCard;
};

describe('move', () => {
	it('위아래로 옮기고, 끝을 넘으면 그대로', () => {
		expect(move(['a', 'b', 'c', 'd'], 3, -3)).toEqual(['d', 'a', 'b', 'c']);
		expect(move(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
		expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
		expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
		expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
	});
});

describe('groupByOwner', () => {
	it('내 계정을 맨 앞에, 나머지는 나온 순서대로', () => {
		const groups = groupByOwner([repo('org/a'), repo('Me/b'), repo('other/c'), repo('org/d'), repo('me/e')], 'me');
		expect(groups.map((group) => [group.owner, group.repos.map((item) => item.name)])).toEqual([
			['Me', ['b', 'e']],
			['org', ['a', 'd']],
			['other', ['c']],
		]);
	});
});

describe('sameRepo', () => {
	it('대소문자를 가리지 않는다', () => {
		expect(sameRepo('Me/Repo', 'me/repo')).toBe(true);
		expect(sameRepo('me/a', 'me/b')).toBe(false);
	});
});
