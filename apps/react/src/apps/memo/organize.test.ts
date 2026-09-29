import { describe, expect, it } from 'vitest';
import {
	addFolder,
	canAddFolder,
	canMoveFolder,
	EMPTY_ORGANIZATION,
	moveFolder,
	movePost,
	organizePosts,
	removeFolder,
	renameFolder,
	setPinned,
	splitPinned,
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

describe('폴더 이름 바꾸기', () => {
	it('안의 글과 하위 폴더가 새 이름을 따라간다', () => {
		const org = renameFolder(addFolder(EMPTY_ORGANIZATION, '개발기', '읽을거리'), '개발기', '작업기');
		expect(org.folders).toEqual(['작업기/읽을거리']);
		expect(categories(organizePosts(posts, org))).toEqual({ a: '작업기/MacFolio', b: '작업기', c: '회고' });
	});

	it('같은 이름이면 그대로', () => {
		expect(renameFolder(EMPTY_ORGANIZATION, '개발기', ' 개발기 ')).toBe(EMPTY_ORGANIZATION);
	});
});

describe('폴더는 3단까지', () => {
	it('3단 폴더 안에는 새 폴더를 만들 수 없다', () => {
		expect(canAddFolder('')).toBe(true);
		expect(canAddFolder('a/b')).toBe(true);
		expect(canAddFolder('a/b/c')).toBe(false);
		expect(addFolder(EMPTY_ORGANIZATION, 'a/b/c', 'd')).toBe(EMPTY_ORGANIZATION);
	});

	it('옮긴 뒤 하위 폴더까지 3단을 넘으면 옮길 수 없다', () => {
		const all = ['x', 'x/y', 'p', 'p/q', 'r'];
		// x(2단 높이)를 p 안으로: p/x/y → 3단 (가능)
		expect(canMoveFolder('x', 'p', all)).toBe(true);
		// x를 p/q 안으로: p/q/x/y → 4단 (불가)
		expect(canMoveFolder('x', 'p/q', all)).toBe(false);
		// 하위 폴더가 없는 r은 p/q 안으로 (3단) 가능
		expect(canMoveFolder('r', 'p/q', all)).toBe(true);
		expect(moveFolder(EMPTY_ORGANIZATION, 'x', 'p/q', all)).toBe(EMPTY_ORGANIZATION);
	});
});

describe('메모 고정', () => {
	it('머리말의 pinned를 따르고, 방문자가 고정을 바꿀 수 있다', () => {
		const list = [{ ...post('a', 'x'), pinned: true }, post('b', 'x'), post('c', 'x')];
		const org = setPinned(setPinned(EMPTY_ORGANIZATION, 'a', false), 'c', true);
		const { pinned, others } = splitPinned(organizePosts(list, org));
		expect(pinned.map((item) => item.slug)).toEqual(['c']);
		expect(others.map((item) => item.slug)).toEqual(['a', 'b']);
	});

	it('고정을 바꾸지 않은 글은 그대로 둔다', () => {
		const list = [post('a', 'x')];
		expect(organizePosts(list, EMPTY_ORGANIZATION)[0]).toBe(list[0]);
	});
});
