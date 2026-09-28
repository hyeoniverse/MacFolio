import { describe, expect, it } from 'vitest';
import {
	addFolder,
	canMoveFolder,
	EMPTY_ORGANIZATION,
	moveFolder,
	movePost,
	organizePosts,
	removeFolder,
	validateFolderName,
} from './organize';
import type { Post } from './posts';

const post = (slug: string, category: string): Post => ({
	slug,
	title: slug,
	date: '2026-09-28',
	category,
	summary: '',
	body: '',
});
const posts = [post('a', '개발기/MacFolio'), post('b', '개발기'), post('c', '회고')];
const categories = (list: Post[]) => Object.fromEntries(list.map((p) => [p.slug, p.category]));

describe('validateFolderName', () => {
	it('알맞은 이름은 통과한다', () => {
		expect(validateFolderName(' 읽을거리 ', ['개발기'])).toBeNull();
	});

	it('비었거나 길거나 / 가 있거나 같은 자리에 이미 있으면 안내한다', () => {
		expect(validateFolderName('  ', [])).toBe('폴더 이름을 입력하세요.');
		expect(validateFolderName('가'.repeat(31), [])).toBe('30자 이하로 입력하세요.');
		expect(validateFolderName('a/b', [])).toBe("이름에 '/'는 쓸 수 없어요.");
		expect(validateFolderName('Blog', ['blog'])).toBe('이미 있는 폴더예요.');
	});
});

describe('폴더 만들기·지우기', () => {
	it('맨 위나 고른 폴더 아래에 만든다', () => {
		const org = addFolder(addFolder(EMPTY_ORGANIZATION, '', '읽을거리'), '개발기', '메모');
		expect(org.folders).toEqual(['읽을거리', '개발기/메모']);
	});

	it('지우면 그 아래 만든 폴더도 지운다', () => {
		const org = { ...EMPTY_ORGANIZATION, folders: ['읽을거리', '읽을거리/책', '회고'] };
		expect(removeFolder(org, '읽을거리').folders).toEqual(['회고']);
	});
});

describe('글 옮기기', () => {
	it('글의 폴더만 바뀐다', () => {
		const result = organizePosts(posts, movePost(EMPTY_ORGANIZATION, 'b', '회고'));
		expect(categories(result)).toEqual({ a: '개발기/MacFolio', b: '회고', c: '회고' });
	});
});

describe('폴더 옮기기', () => {
	it('안의 글과 하위 폴더가 함께 옮겨 간다', () => {
		const org = moveFolder(EMPTY_ORGANIZATION, '개발기', '회고');
		expect(categories(organizePosts(posts, org))).toEqual({
			a: '회고/개발기/MacFolio',
			b: '회고/개발기',
			c: '회고',
		});
	});

	it('여러 번 옮기면 순서대로 적용된다', () => {
		let org = moveFolder(EMPTY_ORGANIZATION, '개발기/MacFolio', '');
		org = moveFolder(org, 'MacFolio', '회고');
		expect(organizePosts(posts, org)[0].category).toBe('회고/MacFolio');
	});

	it('옮긴 글과 만든 폴더도 폴더를 따라간다', () => {
		let org = addFolder(EMPTY_ORGANIZATION, '회고', '책');
		org = movePost(org, 'b', '회고/책');
		org = moveFolder(org, '회고', '개발기');
		expect(org.folders).toEqual(['개발기/회고/책']);
		expect(org.posts.b).toBe('개발기/회고/책');
	});

	it('자기 자신이나 자기 아래로는 옮기지 못하고, 이미 그 자리면 옮기지 않는다', () => {
		expect(canMoveFolder('개발기', '개발기')).toBe(false);
		expect(canMoveFolder('개발기', '개발기/MacFolio')).toBe(false);
		expect(canMoveFolder('개발기/MacFolio', '개발기')).toBe(false);
		expect(canMoveFolder('개발기/MacFolio', '')).toBe(true);
		expect(moveFolder(EMPTY_ORGANIZATION, '개발기', '개발기')).toBe(EMPTY_ORGANIZATION);
	});
});
