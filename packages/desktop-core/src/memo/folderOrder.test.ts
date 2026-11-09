import { describe, expect, it } from 'vitest';
import { folderOrderOf } from './folderOrder.js';
import { buildFolderTree, type Post } from './posts.js';

const post = (category: string) => ({ category }) as Post;

describe('폴더 순서', () => {
	it('데브코스 폴더는 가나다순이 아니라 커리큘럼 순서', () => {
		const tree = buildFolderTree(
			[post('프로젝트/데브코스/회고'), post('프로젝트/데브코스/백엔드 기초'), post('프로젝트/데브코스/웹 서비스 기초')],
			[],
			folderOrderOf([])
		);
		expect(tree[0].children[0].children.map((node) => node.name)).toEqual(['웹 서비스 기초', '백엔드 기초', '회고']);
	});

	it('관리자가 끌어서 정한 순서가 저장소 순서보다 앞선다', () => {
		const order = folderOrderOf(['프로젝트/데브코스/회고']);
		expect(order[0]).toBe('프로젝트/데브코스/회고');
		expect(order.filter((path) => path === '프로젝트/데브코스/회고')).toHaveLength(1);
	});
});
