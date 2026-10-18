import { describe, expect, it } from 'vitest';
import { fileUrl, type DocumentEntry } from './documents';
import {
	buildLocations,
	countLabel,
	find,
	pathTo,
	previewFolder,
	recentItems,
	search,
	sortItems,
	uploadFolderOf,
	type FolderItem,
} from './files';

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
	albums: [
		{
			id: 'qru',
			name: 'QRU',
			photos: [{ src: '/imgs/projects/qru/home.png' }, { src: '/imgs/projects/qru/demo.mp4' }],
		},
		{ id: 'empty', name: '영상만', photos: [{ src: '/imgs/projects/x/a.mp4' }] },
	],
});

const names = (folder: FolderItem) => folder.children.map((child) => child.name);

describe('buildLocations', () => {
	it('즐겨찾기 위치: 문서, 프로젝트, 블로그, 응용 프로그램 (사진은 프로젝트 폴더 안에만)', () => {
		expect(tree.map((folder) => folder.name)).toEqual(['문서', '프로젝트', '블로그', '응용 프로그램']);
	});

	it('사진: 프로젝트 폴더 안의 사진 폴더에 그림만 (영상은 뺀다). 키는 사이트 주소 그대로', () => {
		expect(names(find(tree, 'projects/qru/photos') as FolderItem)).toEqual(['home.png']);
		const photo = find(tree, 'photo:/imgs/projects/qru/home.png');
		expect(photo).toMatchObject({ kind: 'image', name: 'home.png', key: '/imgs/projects/qru/home.png' });
		expect(fileUrl('/imgs/projects/qru/home.png')).toBe('/imgs/projects/qru/home.png');
	});

	it('문서: 폴더(이력서·포트폴리오·자격증)가 위에, 문서는 이름순', () => {
		const docs = tree[0];
		expect(names(docs)).toEqual(['이력서', '자격증', '포트폴리오', 'deployment.md', 'README.md']);
		const resume = find(tree, 'docs:이력서') as FolderItem;
		expect(resume.children).toEqual([]);
		expect(resume.emptyNote).toBe('공개용 이력서를 준비하고 있습니다.');
		expect((find(tree, 'docs:자격증') as FolderItem).emptyNote).toBe('자격증 사본을 준비하고 있습니다.');
		expect((find(tree, 'docs:포트폴리오') as FolderItem).emptyNote).toBe('포트폴리오 파일을 준비하고 있습니다.');
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
		// 실행하는 앱(프로젝트)은 프로젝트 폴더에 두지 않는다: 응용 프로그램에만
		expect(find(tree, 'project:qru')).toBeNull();
		expect(names(tree[3])).toEqual(['메모', 'Safari']);
	});
});

describe('프로젝트 폴더', () => {
	const files: DocumentEntry[] = [
		{ folder: 'project:qru', name: '발표.pdf', key: 'projects/qru/b.pdf', kind: 'pdf', updated: '2026-10-02' },
		{ folder: 'project:qru', name: '구조도.png', key: 'projects/qru/a.png', kind: 'image', updated: '2026-09-02' },
		{ folder: 'project:gone', name: '없는 프로젝트.pdf', key: 'projects/gone/c.pdf', kind: 'pdf' },
		{ folder: '이력서', name: '이력서.pdf', key: 'resume/r.pdf', kind: 'pdf' },
	];
	const projects = [
		{ id: 'qru', name: 'QRU' },
		{ id: 'plain', name: '빈 프로젝트' },
	];
	const albums = [{ id: 'qru', name: 'QRU', photos: [{ src: '/imgs/projects/qru/home.png' }] }];
	const withProjects = buildLocations({ docs: [], posts: [], projects, apps: [], files, albums });

	it('프로젝트마다 폴더: 프로젝트가 맨 위, 사진 폴더, 올린 파일은 이름순', () => {
		expect(names(find(withProjects, 'projects') as FolderItem)).toEqual(['QRU', '빈 프로젝트']);
		const qru = find(withProjects, 'projects/qru') as FolderItem;
		expect(qru.kind).toBe('folder');
		expect(names(qru)).toEqual(['QRU', '사진', '구조도.png', '발표.pdf']);
		expect(qru.children[0]).toMatchObject({ kind: 'folder', id: 'projects/qru/photos', name: '사진' });
		expect(qru.modified).toBe('2026-10-02');
		expect(find(withProjects, 'file:projects/qru/b.pdf')).toMatchObject({ kind: 'pdf', name: '발표.pdf' });
		const photo = find(withProjects, 'photo:/imgs/projects/qru/home.png');
		expect(photo).toMatchObject({ kind: 'image', key: '/imgs/projects/qru/home.png' });
		expect(pathTo(withProjects, photo!.id).map((item) => item.id)).toEqual([
			'projects',
			'projects/qru',
			'projects/qru/photos',
			photo!.id,
		]);
		// 사진도 올린 파일도 없으면 프로젝트만
		expect(names(find(withProjects, 'projects/plain') as FolderItem)).toEqual(['빈 프로젝트']);
	});

	it('문서 폴더에는 프로젝트 파일이 없고, 없는 프로젝트의 파일은 보이지 않는다', () => {
		expect(names(find(withProjects, 'docs:이력서') as FolderItem)).toEqual(['이력서.pdf']);
		expect(find(withProjects, 'file:projects/gone/c.pdf')).toBeNull();
	});

	it('미리보기 폴더: 올린 파일 전부 (프로젝트 폴더 포함), 사진은 빼고', () => {
		expect(names(previewFolder(withProjects))).toEqual(['구조도.png', '발표.pdf', '이력서.pdf']);
	});

	it('올릴 폴더 값: 문서 폴더 이름 또는 project:<id>', () => {
		expect(uploadFolderOf(find(withProjects, 'docs:이력서'))).toBe('이력서');
		expect(uploadFolderOf(find(withProjects, 'projects/qru'))).toBe('project:qru');
		expect(uploadFolderOf(find(withProjects, 'projects/qru/photos'))).toBeNull();
		expect(uploadFolderOf(find(withProjects, 'projects'))).toBeNull();
		expect(uploadFolderOf(find(withProjects, 'project:qru'))).toBeNull();
	});
});

describe('문서 파일 목록 → 폴더 (시험용 목록)', () => {
	const files: DocumentEntry[] = [
		{ folder: '이력서', name: '이력서.pdf', key: 'resume/resume.pdf', kind: 'pdf', size: 1200, updated: '2026-10-01' },
		{ folder: '자격증', name: 'B 자격증.png', key: 'certs/b.png', kind: 'image', updated: '2026-09-01' },
		{ folder: '자격증', name: 'A 자격증.jpg', key: 'certs/a.jpg', kind: 'image' },
	];
	const withFiles = buildLocations({ docs: [], posts: [], projects: [], apps: [], files });

	it('파일을 그 폴더에 이름순으로, 종류·키·크기·수정일과 함께', () => {
		expect(names(find(withFiles, 'docs:자격증') as FolderItem)).toEqual(['A 자격증.jpg', 'B 자격증.png']);
		expect(find(withFiles, 'file:resume/resume.pdf')).toEqual({
			kind: 'pdf',
			id: 'file:resume/resume.pdf',
			name: '이력서.pdf',
			key: 'resume/resume.pdf',
			size: 1200,
			modified: '2026-10-01',
		});
		expect(find(withFiles, 'file:certs/a.jpg')).toMatchObject({ kind: 'image', key: 'certs/a.jpg' });
		expect((find(withFiles, 'docs:포트폴리오') as FolderItem).children).toEqual([]);
	});

	it('폴더 수정일은 가장 최근 파일, 경로·찾기·최근 항목에도 나온다', () => {
		expect((find(withFiles, 'docs:이력서') as FolderItem).modified).toBe('2026-10-01');
		expect(pathTo(withFiles, 'file:certs/b.png').map((item) => item.name)).toEqual(['문서', '자격증', 'B 자격증.png']);
		expect(search(withFiles, '자격증.').map((item) => item.id)).toEqual(['file:certs/a.jpg', 'file:certs/b.png']);
		expect(recentItems(withFiles).map((item) => item.name)).toEqual(['이력서.pdf', 'B 자격증.png']);
	});
});

describe('파일 주소', () => {
	it('키의 각 부분을 인코딩하고, 내려받기는 ?download=1', () => {
		expect(fileUrl('resume/resume.pdf')).toBe('/files/resume/resume.pdf');
		expect(fileUrl('자격증/a b.png', true)).toBe(`/files/${encodeURIComponent('자격증')}/a%20b.png?download=1`);
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

describe('recentItems', () => {
	it('날짜가 있는 파일을 최신 순으로, 폴더·앱은 빼고', () => {
		expect(recentItems(tree).map((item) => item.name)).toEqual(['새 글', '서버 글', '예전 글', '기타 글']);
		expect(recentItems(tree, 2).map((item) => item.name)).toEqual(['새 글', '서버 글']);
	});
});

describe('sortItems', () => {
	const macfolio = find(tree, 'blog/개발기/MacFolio') as FolderItem;

	it('이름순', () => {
		expect(sortItems(macfolio.children, 'name').map((item) => item.name)).toEqual(['백엔드', '새 글', '예전 글']);
	});

	it('종류: 폴더가 먼저, 같은 종류는 이름순', () => {
		expect(sortItems(tree[0].children, 'kind').map((item) => item.name)).toEqual([
			'이력서',
			'자격증',
			'포트폴리오',
			'deployment.md',
			'README.md',
		]);
	});

	it('날짜: 최신이 위로, 날짜 없는 것은 아래에 이름순', () => {
		expect(sortItems(macfolio.children, 'date').map((item) => item.name)).toEqual(['새 글', '백엔드', '예전 글']);
		// 날짜가 하나도 없으면 이름순 그대로
		expect(sortItems(tree[0].children, 'date').map((item) => item.name)).toEqual([
			'이력서',
			'자격증',
			'포트폴리오',
			'deployment.md',
			'README.md',
		]);
	});
});
