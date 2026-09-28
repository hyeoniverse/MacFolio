import { describe, expect, it } from 'vitest';
import { validateFolderName, withUserFolders } from './userFolders';
import type { FolderNode } from './posts';

describe('validateFolderName', () => {
	it('알맞은 이름은 통과한다', () => {
		expect(validateFolderName(' 읽을거리 ', ['개발기'])).toBeNull();
	});

	it('비었거나 길거나 / 가 있거나 이미 있으면 안내한다', () => {
		expect(validateFolderName('  ', [])).toBe('폴더 이름을 입력하세요.');
		expect(validateFolderName('가'.repeat(31), [])).toBe('30자 이하로 입력하세요.');
		expect(validateFolderName('a/b', [])).toBe("이름에 '/'는 쓸 수 없어요.");
		expect(validateFolderName('Blog', ['blog'])).toBe('이미 있는 폴더예요.');
	});
});

describe('withUserFolders', () => {
	const tree: FolderNode[] = [{ name: '개발기', path: '개발기', count: 2, children: [] }];

	it('방문자가 만든 폴더를 글 0개로 뒤에 붙인다', () => {
		expect(withUserFolders(tree, ['읽을거리'])).toEqual([
			...tree,
			{ name: '읽을거리', path: '읽을거리', count: 0, children: [], custom: true },
		]);
	});

	it('글 폴더와 이름이 같으면 붙이지 않는다', () => {
		expect(withUserFolders(tree, ['개발기'])).toEqual(tree);
	});
});
