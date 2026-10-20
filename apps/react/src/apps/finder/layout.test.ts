import { describe, expect, it } from 'vitest';
import { EMPTY_FINDER_LAYOUT, type FinderLayoutValue } from '@macfolio/contracts';
import { EMPTY_ORGANIZATION, organizePosts, type Organization, type Post } from '@macfolio/desktop-core/memo';
import type { DocumentEntry } from './documents';
import {
	buildLocations,
	buildTree,
	find,
	type TreeInput,
	type FinderItem,
	type FolderItem,
	type AliasItem,
} from './files';
import {
	canDropInto,
	canMove,
	canRename,
	canTrash,
	createFolder,
	moveChange,
	nameProblem,
	renameFolderChange,
	trashChange,
	putBackChange,
	deleteChange,
	untitledName,
	uploadPlan,
	placeFileChange,
} from './edit';

const files: DocumentEntry[] = [
	{ id: 'd1', folder: '이력서', name: '이력서.pdf', key: 'resume/r.pdf', kind: 'pdf', updated: '2026-10-01' },
	{ id: 'd2', folder: 'project:qru', name: '발표.pdf', key: 'projects/qru/b.pdf', kind: 'pdf', updated: '2026-10-02' },
];
const posts = [
	{ slug: 'a', title: '글 A', date: '2026-09-01', category: '개발기' },
	{ slug: 'b', title: '글 B', date: '2026-09-02', category: '기타' },
];

const input = (
	layout: FinderLayoutValue = EMPTY_FINDER_LAYOUT,
	organization: Organization = EMPTY_ORGANIZATION
): TreeInput => ({
	docs: ['README.md'],
	posts: organizePosts(posts as Post[], organization),
	blogFolders: organization.folders,
	projects: [{ id: 'qru', name: 'QRU' }],
	apps: [{ app: 'memo', label: '메모', icon: 'memo.png' }],
	files,
	albums: [{ id: 'qru', name: 'QRU', photos: [{ src: '/imgs/q.png' }] }],
	layout,
});
const build = (layout?: FinderLayoutValue, organization?: Organization) => buildLocations(input(layout, organization));
const TREE_INPUT = input();
const folder = (roots: FinderItem[], id: string) => find(roots, id) as FolderItem;
const names = (item: FolderItem) => item.children.map((child) => child.name);
const state = (layout = EMPTY_FINDER_LAYOUT, organization = EMPTY_ORGANIZATION) => ({ layout, organization });

describe('폴더 구조 겹치기', () => {
	it('파일 끌어다 놓기: 어느 폴더든 가장 가까운 문서 폴더에 올리고 놓은 자리에 둔다', () => {
		const custom = { id: 'folder:abcd1234', name: '발표 자료', parent: 'projects/qru' };
		const onDesk = { id: 'folder:desk0001', name: '모음', parent: 'desktop' };
		const roots = build({ ...EMPTY_FINDER_LAYOUT, folders: [custom, onDesk] });
		expect(uploadPlan(roots, find(roots, 'docs:이력서'))).toEqual({
			folder: '이력서',
			target: 'docs:이력서',
			place: null,
		});
		expect(uploadPlan(roots, find(roots, custom.id))).toEqual({
			folder: 'project:qru',
			target: custom.id,
			place: custom.id,
		});
		expect(uploadPlan(roots, find(roots, 'desktop'))).toMatchObject({ folder: '데스크탑', place: null });
		expect(uploadPlan(roots, find(roots, onDesk.id))).toMatchObject({ folder: '데스크탑', place: onDesk.id });
		// 바탕화면의 가상본에 놓으면 원래 폴더로
		expect(uploadPlan(roots, find(roots, 'alias:docs:자격증'))).toMatchObject({ folder: '자격증', place: null });
		expect(uploadPlan(roots, find(roots, 'blog'))).toBeNull();
		expect(uploadPlan(roots, find(roots, 'apps'))).toBeNull();
		// 올린 뒤 놓은 자리에 보인다
		const placed = placeFileChange(state().layout, 'projects/qru/b.pdf', custom.id).layout!;
		const after = build({ ...placed, folders: [custom, onDesk] });
		expect(names(folder(after, custom.id))).toEqual(['발표.pdf']);
		expect(names(folder(after, 'projects/qru'))).not.toContain('발표.pdf');
	});

	it('데스크탑: 처음에는 이력서·포트폴리오·자격증 가상본 (예전 프로젝트 가상본은 건너뛴다)', () => {
		const desktop = folder(build(), 'desktop');
		expect(desktop.children.map((item) => (item as AliasItem).target)).toEqual([
			'docs:이력서',
			'docs:포트폴리오',
			'docs:자격증',
		]);
		// 예전에 저장한 projects 가상본은 없는 폴더라 보이지 않는다
		const legacy = folder(build({ ...EMPTY_FINDER_LAYOUT, aliases: ['projects', 'docs:이력서'] }), 'desktop');
		expect(legacy.children.map((item) => item.id)).toEqual(['alias:docs:이력서']);
		// 프로젝트 폴더는 포트폴리오 안
		expect(names(folder(build(), 'docs:포트폴리오'))).toEqual(['QRU']);
		// 가상본은 비어 있고(원래 폴더로 간다) 편집할 수 없지만 휴지통으로 보낼 수는 있다
		const alias = desktop.children[0];
		expect(canRename(alias) || canMove(alias)).toBe(false);
		expect(canTrash(alias)).toBe(true);
	});

	it('새 폴더: 문서·데스크탑에는 구조에, 블로그에는 메모 폴더로', () => {
		let roots = build();
		const docs = createFolder(
			folder(roots, 'docs'),
			untitledName(folder(roots, 'docs').children),
			state(),
			'folder:aaaa'
		);
		const desk = createFolder(folder(roots, 'desktop'), '작업', state(docs.layout), 'folder:bbbb');
		roots = build(desk.layout);
		expect(names(folder(roots, 'docs'))).toContain('이름 없는 폴더');
		expect(folder(roots, 'folder:bbbb').name).toBe('작업');
		expect(untitledName(folder(roots, 'docs').children)).toBe('이름 없는 폴더 2');

		const blog = createFolder(folder(roots, 'blog'), '읽을거리', state());
		expect(blog.id).toBe('blog/읽을거리');
		expect(names(folder(build(EMPTY_FINDER_LAYOUT, blog.organization), 'blog'))).toEqual([
			'개발기',
			'기타',
			'읽을거리',
		]);
	});

	it('파일을 만든 폴더로 옮긴다 (R2 키는 그대로), 원래 폴더로 돌아오면 적어 둔 자리를 지운다', () => {
		const layout: FinderLayoutValue = {
			...EMPTY_FINDER_LAYOUT,
			folders: [{ id: 'folder:aaaa', name: '발표', parent: 'docs' }],
		};
		let roots = build(layout);
		const file = find(roots, 'file:resume/r.pdf')!;
		expect(canDropInto(roots, [file], folder(roots, 'folder:aaaa'))).toBe(true);
		const moved = moveChange(roots, [file], folder(roots, 'folder:aaaa'), state(layout)).layout!;
		expect(moved.files).toEqual({ 'file:resume/r.pdf': 'folder:aaaa' });
		roots = build(moved);
		expect(names(folder(roots, 'folder:aaaa'))).toEqual(['이력서.pdf']);
		expect(folder(roots, 'docs:이력서').children).toEqual([]);
		expect(find(roots, 'file:resume/r.pdf')).toMatchObject({ key: 'resume/r.pdf' });
		expect(folder(roots, 'folder:aaaa').modified).toBe('2026-10-01');
		const back = moveChange(roots, [find(roots, 'file:resume/r.pdf')!], folder(roots, 'docs:이력서'), state(moved));
		expect(back.layout!.files).toEqual({});
	});

	it('폴더 안의 폴더, 프로젝트 폴더 안의 폴더', () => {
		const roots = build({
			...EMPTY_FINDER_LAYOUT,
			folders: [
				{ id: 'folder:bbbb', name: '초안', parent: 'folder:aaaa' },
				{ id: 'folder:aaaa', name: '발표', parent: 'projects/qru' },
			],
			files: { 'file:projects/qru/b.pdf': 'folder:bbbb' },
		});
		expect(names(folder(roots, 'projects/qru'))).toEqual(['발표', '사진']);
		expect(names(folder(roots, 'folder:aaaa'))).toEqual(['초안']);
		expect(names(folder(roots, 'folder:bbbb'))).toEqual(['발표.pdf']);
		// 자기 안으로는 놓을 수 없다
		expect(canDropInto(roots, [folder(roots, 'folder:aaaa')], folder(roots, 'folder:bbbb'))).toBe(false);
	});

	it('없는 파일·폴더를 가리키는 자리는 건너뛰고, 고리가 있는 폴더는 보이지 않는다', () => {
		const roots = build({
			folders: [
				{ id: 'folder:aaaa', name: '가', parent: 'folder:bbbb' },
				{ id: 'folder:bbbb', name: '나', parent: 'folder:aaaa' },
				{ id: 'folder:cccc', name: '다', parent: 'projects/deleted' },
			],
			files: { 'file:gone.pdf': 'docs', 'file:resume/r.pdf': 'folder:zzzz' },
			aliases: ['docs:이력서', 'projects/deleted'],
		});
		expect(find(roots, 'folder:aaaa')).toBeNull();
		expect(find(roots, 'folder:cccc')).toBeNull();
		expect(names(folder(roots, 'docs:이력서'))).toEqual(['이력서.pdf']);
		expect(folder(roots, 'desktop').children.map((item) => item.id)).toEqual(['alias:docs:이력서']);
	});

	it('시스템 항목은 옮기거나 이름을 바꿀 수 없고, 쪽이 다르면 놓을 수 없다', () => {
		const roots = build();
		for (const id of ['docs', 'docs:이력서', 'projects/qru', 'projects/qru/photos', 'docs:README.md', 'app:memo'])
			expect(canMove(find(roots, id)!) || canRename(find(roots, id)!)).toBe(false);
		expect(canDropInto(roots, [find(roots, 'post:a')!], folder(roots, 'docs'))).toBe(false);
		expect(canDropInto(roots, [find(roots, 'file:resume/r.pdf')!], folder(roots, 'blog'))).toBe(false);
		expect(canDropInto(roots, [find(roots, 'file:resume/r.pdf')!], folder(roots, 'projects/qru/photos'))).toBe(false);
		// 가상본 위에 놓으면 원래 폴더로
		const alias = folder(roots, 'desktop').children.find((item) => item.id === 'alias:docs:자격증')!;
		expect(canDropInto(roots, [find(roots, 'file:resume/r.pdf')!], alias)).toBe(true);
	});

	it('블로그: 글·폴더를 옮기고 이름을 바꾸면 메모의 정리 내용이 바뀐다', () => {
		let roots = build();
		const moved = moveChange(roots, [find(roots, 'post:a')!], folder(roots, 'blog/기타'), state()).organization!;
		expect(moved.posts).toEqual({ a: '기타' });
		roots = build(EMPTY_FINDER_LAYOUT, moved);
		expect(names(folder(roots, 'blog/기타'))).toEqual(['글 B', '글 A']);
		const renamed = renameFolderChange(folder(roots, 'blog/기타'), '모음', state(EMPTY_FINDER_LAYOUT, moved), []);
		roots = build(EMPTY_FINDER_LAYOUT, renamed.organization);
		expect(names(folder(roots, 'blog'))).toContain('모음');
		const nested = moveChange(
			roots,
			[folder(roots, 'blog/개발기')],
			folder(roots, 'blog/모음'),
			state(EMPTY_FINDER_LAYOUT, renamed.organization)
		);
		expect(find(build(EMPTY_FINDER_LAYOUT, nested.organization), 'blog/모음/개발기')).not.toBeNull();
	});

	it('이름 검사와 휴지통: 폴더를 지우면 안의 폴더와 파일도 (파일은 서버에서 지운다)', () => {
		const layout: FinderLayoutValue = {
			folders: [
				{ id: 'folder:aaaa', name: '발표', parent: 'docs' },
				{ id: 'folder:bbbb', name: '초안', parent: 'folder:aaaa' },
			],
			files: { 'file:resume/r.pdf': 'folder:bbbb' },
			aliases: null,
		};
		const roots = build(layout);
		expect(nameProblem(folder(roots, 'docs').children, '발표')).toMatch(/이미 사용 중/);
		expect(nameProblem(folder(roots, 'docs').children, '발표', 'folder:aaaa')).toBeNull();
		expect(nameProblem([], 'a/b')).not.toBeNull();
		// 휴지통으로: 지우지 않고 휴지통 폴더로 옮기고 원래 자리를 적는다
		const trashed = trashChange(roots, [folder(roots, 'folder:aaaa')], state(layout)).layout!;
		expect(trashed.folders[0]).toMatchObject({ id: 'folder:aaaa', parent: 'trash' });
		expect(trashed.trash).toEqual({ 'folder:aaaa': 'docs' });
		const { roots: after, trash } = buildTree({ ...TREE_INPUT, layout: trashed });
		expect(find(after, 'folder:aaaa')).toBeNull();
		expect(trash.children.map((item) => item.name)).toEqual(['발표']);
		// 되돌려 놓기: 원래 폴더로
		const back = putBackChange([...after, trash], trash.children, state(trashed)).layout!;
		expect(back.folders[0].parent).toBe('docs');
		expect(back.trash).toEqual({});
		// 파일을 휴지통으로 보냈다가 되돌리면 올린 폴더(적어 둔 자리 없음)로
		const fileTrashed = trashChange(build(), [find(build(), 'file:resume/r.pdf')!], state()).layout!;
		expect(fileTrashed.files).toEqual({ 'file:resume/r.pdf': 'trash' });
		const fileTree = buildTree({ ...TREE_INPUT, layout: fileTrashed });
		expect(
			putBackChange([...fileTree.roots, fileTree.trash], fileTree.trash.children, state(fileTrashed)).layout!.files
		).toEqual({});
		// 영구 삭제: 안의 폴더·파일까지 구조에서 빼고 서버에서 지울 파일을 모은다
		const removed = deleteChange(trash.children, state(trashed));
		expect(removed.layout!.folders).toEqual([]);
		expect(removed.layout!.files).toEqual({});
		expect(removed.layout!.trash).toEqual({});
		expect(removed.documents).toEqual(['d1']);
		const alias = trashChange(roots, [folder(roots, 'desktop').children[0]], state(layout));
		expect(alias.layout!.aliases).toEqual(['docs:포트폴리오', 'docs:자격증']);
	});
});
