import type React from 'react';
import { describe, expect, it } from 'vitest';
import { landingOf } from '@/apps/safari/project/landing';
import { GENERAL_SAMPLE } from '@/apps/settings/lookSamples';
import type { Project } from '@/shared/profile';
import { repoAccent } from './accent';
import { SECTION_ORDER } from '@/apps/safari/project/landing';
import {
	cloneUrl,
	commitsOf,
	commitType,
	docPath,
	docsOf,
	docsTree,
	docText,
	fakeHash,
	mergeTree,
	repoOf,
	structureRepo,
	tagsOf,
} from './repo';
import { findPage, pageCommands, runRepo, type ShellData } from './shell';

const sample = { ...GENERAL_SAMPLE, id: 'sample', url: 'https://github.com/me/bookclub', demo: '' } as Project;

describe('repoOf·cloneUrl', () => {
	it('GitHub 주소에서 owner와 이름을 읽고, 아니면 이름만 둔다', () => {
		expect(repoOf('https://github.com/hyeoniverse/QRU/', 'QRU')).toEqual({ owner: 'hyeoniverse', name: 'QRU' });
		expect(repoOf('https://gitlab.com/a/b', 'x')).toEqual({ name: 'b' });
		expect(repoOf(undefined, '빈 프로젝트')).toEqual({ name: '빈-프로젝트' });
		expect(cloneUrl('https://github.com/a/b')).toBe('https://github.com/a/b.git');
		expect(cloneUrl('https://gitlab.com/a/b/')).toBe('https://gitlab.com/a/b');
	});
});

describe('커밋', () => {
	it('해시는 같은 글이면 같은 일곱 자리다', () => {
		expect(fakeHash('a')).toMatch(/^[0-9a-f]{7}$/);
		expect(fakeHash('a')).toBe(fakeHash('a'));
	});

	it('말에 실마리가 있으면 그 타입, 커밋 규칙이 없으면 기본 타입에서 고른다', () => {
		expect(commitType('모임 찾기와 가입 흐름 구현', ['feat', 'docs'])).toBe('feat');
		expect(commitType('발표와 회고', ['feat', 'docs'])).toBe('docs');
		expect(commitType('무엇이든', [])).toBeUndefined();
		const commits = commitsOf(GENERAL_SAMPLE.timeline ?? []);
		expect(commits).toHaveLength(7);
		expect(commits.every((commit) => commit.type)).toBe(true);
		expect(commitsOf([{ date: '1', label: '예제 풀기' }], [{ type: 'example' }])[0].type).toBe('example');
	});

	it('태그는 v0.1.0부터, 마지막은 v1.0.0', () => {
		expect(tagsOf(3)).toEqual(['v0.1.0', 'v0.2.0', 'v1.0.0']);
	});
});

describe('structureRepo', () => {
	it('폴더 구조 글을 트리로 바꾸고, 저장소 자신인 맨 위 폴더는 벗긴다', () => {
		const { dir, notes } = structureRepo(GENERAL_SAMPLE.structure ?? '');
		expect(Object.keys(dir).sort()).toEqual(['docker-compose.yml', 'server', 'web']);
		expect(Object.keys(dir.web as object).sort()).toEqual(['features', 'shared']);
		expect(Object.keys(dir.server as object).sort()).toEqual(['progress', 'routes']);
		expect(notes['server/progress']).toBe('진도별 글 가리기');
	});

	it('경로가 붙은 이름은 폴더를 거쳐 넣는다', () => {
		const { dir } = structureRepo('a/\n├── scripts/run.py   # 실행\n└── tests/');
		expect(dir).toEqual({ scripts: { 'run.py': '실행' }, tests: {} });
	});
});

describe('문서', () => {
	it('README가 먼저, 구역마다 docs/의 문서 하나를 구역 차례대로 둔다', () => {
		const docs = docsOf(landingOf(sample));
		expect(docs.map(docPath)).toEqual([
			'README.md',
			'docs/FEATURES.md',
			'docs/SCREENSHOTS.md',
			'docs/USAGE.md',
			'docs/ARCHITECTURE.md',
			'docs/TROUBLESHOOTING.md',
			'docs/STORIES.md',
			'docs/CONTROLS.md',
			'docs/TECH.md',
			'docs/TEAM.md',
			'docs/CONTRIBUTING.md',
			'docs/CHANGELOG.md',
			'docs/DEPLOYMENT.md',
			'docs/CREDITS.md',
		]);
		expect(docs.flatMap((doc) => doc.sections.map((section) => section.kind))).toEqual([...SECTION_ORDER]);
	});

	it('내용이 없어도 README는 있고, 주요 기능만 있으면 README와 FEATURES.md', () => {
		const landing = landingOf(sample);
		const hero = { ...landing.hero, subhead: undefined };
		expect(docsOf({ ...landing, hero, sections: [] }).map(docPath)).toEqual(['README.md']);
		const features = landing.sections.filter((section) => section.kind === 'features');
		expect(docsOf({ ...landing, hero, sections: features }).map(docPath)).toEqual(['README.md', 'docs/FEATURES.md']);
	});

	it('README 원문은 소개와 숫자와 목차, 문서 원문은 그 구역', () => {
		const landing = landingOf(sample);
		const docs = docsOf(landing);
		const readme = docText(landing, docs[0], docs);
		expect(readme).toContain(`# ${GENERAL_SAMPLE.name}`);
		expect(readme).toContain('## 목차');
		expect(readme).toContain('- [주요 기능](docs/FEATURES.md)');
		const features = docText(landing, docs[1], docs);
		expect(features.startsWith('## 주요 기능')).toBe(true);
		expect(features).toContain(GENERAL_SAMPLE.highlights[0].title);
		const tree = docsTree(landing, docs);
		expect(Object.keys(tree)).toEqual(['README.md', 'docs']);
		expect(Object.keys(tree.docs as object)).toHaveLength(13);
	});

	it('트러블슈팅·팀원·배포 결과물의 원문: 단계는 굵은 이름표, 팀원은 표(나 표시), 배포는 링크와 플랫폼', () => {
		const landing = landingOf(sample);
		const docs = docsOf(landing);
		const text = (id: string) =>
			docText(
				landing,
				docs.find((doc) => doc.id === id)!,
				docs
			);
		const trouble = text('troubleshooting');
		expect(trouble).toContain(`### ${GENERAL_SAMPLE.troubleshooting![0].title}`);
		expect(trouble).toContain(`- **문제**: ${GENERAL_SAMPLE.troubleshooting![0].problem}`);
		expect(trouble).toContain('- **결과**:');
		const team = text('team');
		expect(team).toContain('| 이름 | 역할 |');
		expect(team).toContain('| [김현](https://github.com/hyeoniverse) (나) |');
		expect(text('deployments')).toContain('- [북클럽 웹](https://bookclub-demo.vercel.app): Vercel — ');
	});

	it('같은 이름의 폴더는 합치고 파일은 문서가 이긴다', () => {
		expect(
			mergeTree({ docs: { 'a.md': '' }, 'README.md': '설명' }, { docs: { 'B.md': 'b' }, 'README.md': '# x' })
		).toEqual({
			docs: { 'a.md': '', 'B.md': 'b' },
			'README.md': '# x',
		});
	});
});

describe('셸', () => {
	const data: ShellData = { landing: landingOf(sample), conventions: [] };

	it('구역이 있는 페이지 명령만 생긴다', () => {
		expect(pageCommands(data).map((command) => command.view)).toEqual([
			'about',
			'stat',
			'log',
			'features',
			'build',
			'whoami',
			'stack',
		]);
		const empty: ShellData = {
			landing: landingOf({ ...sample, highlights: [], timeline: undefined }),
			conventions: [],
		};
		expect(findPage(empty, 'git log')).toBeUndefined();
		expect(findPage(data, 'WHOAMI')?.view).toBe('whoami');
	});

	it('폴더 구조로 만든 트리를 ls·cd로 돌아본다', () => {
		const { dir } = structureRepo(GENERAL_SAMPLE.structure ?? '');
		const ls = runRepo(data, dir, 'ls', []);
		expect(ls.output.kind === 'list' && ls.output.items.map((item) => item.name)).toContain('ABOUT.md');
		const cd = runRepo(data, dir, 'cd server', []);
		expect(cd.cwd).toEqual(['server']);
		expect(runRepo(data, dir, 'cd nowhere', []).output.kind).toBe('error');
	});

	it('docs/의 문서를 ls로 보고 cat으로 읽는다', () => {
		const landing = landingOf(sample);
		const dir = mergeTree(structureRepo(GENERAL_SAMPLE.structure ?? '').dir, docsTree(landing));
		const ls = runRepo(data, dir, 'ls docs', []);
		expect(ls.output.kind === 'list' && ls.output.items.map((item) => item.name)).toContain('USAGE.md');
		const cat = runRepo(data, dir, 'cat docs/USAGE.md', []);
		expect(cat.output.kind === 'file' && cat.output.text).toContain('## 쓰는 법');
	});
});

describe('repoAccent', () => {
	const vars = (hue: number) => ({ '--lk-accent': `hsl(${hue} 80% 40%)` }) as React.CSSProperties;
	it('맑은 색은 그대로, 노랑에서 연두까지는 기본 파랑으로 돌린다', () => {
		expect(repoAccent(vars(210))).toEqual(vars(210));
		expect(repoAccent(vars(50))).toEqual({});
	});
});
