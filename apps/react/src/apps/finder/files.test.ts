import { describe, expect, it } from 'vitest';
import { buildLocations, countLabel, find, pathTo, search, type FolderItem } from './files';

const tree = buildLocations({
	docs: ['README.md', 'docs/deployment.md'],
	posts: [
		{ slug: 'old', title: '예전 글', date: '2026-09-01', category: '개발기/MacFolio' },
		{ slug: 'new', title: '새 글', date: '2026-10-03', category: '개발기/MacFolio' },
		{ slug: 'api', title: '서버 글', date: '2026-09-20', category: '개발기/MacFolio/백엔드' },
		{ slug: 'etc', title: '기타 글', date: '2026-08-01', category: '기타' },
	],
	projects: [{ id: 'qru', name: 'QRU', icon: '/imgs/projects/qru/icon.png', period: '2025.03 – 2025.05' }],
	apps: [
		{ app: 'safari', label: 'Safari', icon: 'safari.png' },
		{ app: 'memo', label: '메모', icon: 'memo.png' },
	],
});

const names = (folder: FolderItem) => folder.children.map((child) => child.name);

describe('buildLocations', () => {
	it('즐겨찾기 위치: 문서, 프로젝트, 블로그, 응용 프로그램', () => {
		expect(tree.map((folder) => folder.name)).toEqual(['문서', '프로젝트', '블로그', '응용 프로그램']);
	});

	it('문서: 폴더(이력서 자리)가 위에, 문서는 이름순', () => {
		const docs = tree[0];
		expect(names(docs)).toEqual(['이력서', 'deployment.md', 'README.md']);
		const resume = find(tree, 'docs:이력서') as FolderItem;
		expect(resume.children).toEqual([]);
		expect(resume.emptyNote).toBeTruthy();
		expect(find(tree, 'docs:docs/deployment.md')).toMatchObject({ kind: 'doc', path: 'docs/deployment.md' });
	});

	it('블로그: 카테고리를 폴더로, 폴더가 위에, 글은 최신순, 폴더 수정일은 가장 최근 글', () => {
		const blog = tree[2];
		expect(names(blog)).toEqual(['개발기', '기타']);
		const macfolio = find(tree, 'blog/개발기/MacFolio') as FolderItem;
		expect(names(macfolio)).toEqual(['백엔드', '새 글', '예전 글']);
		expect(macfolio.modified).toBe('2026-10-03');
		expect((find(tree, 'blog/개발기/MacFolio/백엔드') as FolderItem).modified).toBe('2026-09-20');
		expect(blog.modified).toBe('2026-10-03');
		expect(find(tree, 'post:new')).toMatchObject({ kind: 'post', slug: 'new', modified: '2026-10-03' });
	});

	it('프로젝트와 앱', () => {
		expect(find(tree, 'project:qru')).toMatchObject({ kind: 'project', projectId: 'qru', period: '2025.03 – 2025.05' });
		expect(names(tree[3])).toEqual(['메모', 'Safari']);
	});
});

describe('pathTo', () => {
	it('위치에서 항목까지의 폴더들', () => {
		expect(pathTo(tree, 'post:api').map((item) => item.name)).toEqual([
			'블로그',
			'개발기',
			'MacFolio',
			'백엔드',
			'서버 글',
		]);
		expect(pathTo(tree, 'nope')).toEqual([]);
	});
});

describe('search', () => {
	it('위치 전체에서 이름으로 (대소문자 무시)', () => {
		expect(search(tree, 'readme').map((item) => item.id)).toEqual(['docs:README.md']);
		expect(search(tree, '글').map((item) => item.name)).toEqual(['서버 글', '새 글', '예전 글', '기타 글']);
		expect(search(tree, '   ')).toEqual([]);
	});
});

it('countLabel', () => {
	expect(countLabel(0)).toBe('비어 있음');
	expect(countLabel(3)).toBe('항목 3개');
});
