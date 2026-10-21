import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTS, type Project } from '@/shared/profile';
import { DEFAULT_PROFILE } from '@/shared/site/profileStore';
import { importProfile, importProject } from './resumeImport';
import { parseResume } from './resumeModel';

const profile = {
	...DEFAULT_PROFILE,
	name: '홍길동',
	email: 'gildong@example.com',
	github: 'https://github.com/gildong',
};
const project = (id: string) => DEFAULT_PROJECTS.find((item) => item.id === id) as Project;

describe('importProfile', () => {
	it('이름·연락처는 프로필로 바꾸고, 지금 글의 직함·한 줄 소개와 절은 그대로 둔다', () => {
		const markdown =
			'# 김정현\n\n**웹 개발자**\n\n> 끝까지 만드는 개발자\n\nold@example.com\n\n## 강점\n\n- **끝까지 운영** — 서비스 2개';
		const next = importProfile(markdown, profile, 'example.com');
		const resume = parseResume(next);
		expect(resume).toMatchObject({
			name: '홍길동',
			role: '웹 개발자',
			motto: '끝까지 만드는 개발자',
			contact: ['gildong@example.com', 'github.com/gildong', 'example.com'],
		});
		expect(next).toContain('## 강점\n\n- **끝까지 운영** — 서비스 2개');
		expect(next).not.toContain('old@example.com');
	});

	it('머리에 직함이 없으면 프로필의 직무, 절이 없는 글도 받는다', () => {
		expect(parseResume(importProfile('', profile, 'example.com')).role).toBe(profile.role);
	});
});

describe('importProject', () => {
	const base =
		'# 이름\n\n## 강점\n\n- **끝까지 운영** — 운영\n\n## 프로젝트\n\n### [QRU](#project/qru) | 예전 기간\n\n예전 설명\n\n`Old`\n\n- **복합 색인 0개** — 단일 필드 색인\n\n## 교육\n\n- **학교** | 2020 — 전공';

	it('이미 있는 프로젝트는 머리 줄·설명·기술만 지금 값으로 바꾸고 성과는 그대로 둔다', () => {
		const { markdown, replaced } = importProject(base, project('qru'));
		expect(replaced).toBe(true);
		const section = parseResume(markdown).sections.find((item) => item.kind === 'projects');
		expect(section?.kind === 'projects' && section.projects).toEqual([
			expect.objectContaining({
				name: project('qru').name,
				projectId: 'qru',
				description: expect.stringContaining('QR 디지털 명함'),
				stack: project('qru').stack,
				bullets: [{ title: '복합 색인 0개', detail: '단일 필드 색인' }],
			}),
		]);
		expect(markdown).not.toContain('예전');
		expect(markdown).toContain('## 교육');
	});

	it('없는 프로젝트는 프로젝트 절 끝에 성과 자리와 함께 더한다 (다음 절 앞)', () => {
		const { markdown, replaced } = importProject(base, project('macfolio'));
		expect(replaced).toBe(false);
		const section = parseResume(markdown).sections.find((item) => item.kind === 'projects');
		expect(section?.kind === 'projects' && section.projects.map((item) => item.projectId)).toEqual(['qru', 'macfolio']);
		expect(markdown.indexOf('(#project/macfolio)')).toBeLessThan(markdown.indexOf('## 교육'));
	});

	it('프로젝트 절이 없으면 맨 끝에 ## 프로젝트를 만든다', () => {
		const { markdown } = importProject('# 이름\n\n## 강점\n\n- **운영** — 운영', project('qru'));
		expect(parseResume(markdown).sections.at(-1)).toMatchObject({ kind: 'projects', title: '프로젝트' });
	});
});
