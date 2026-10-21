import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTS, type Project } from '@/shared/profile';
import { RESUME } from '@/shared/profile/resume';
import { DEFAULT_PROFILE } from '@/shared/site/profileStore';
import { PROJECT_LINK, projectLinkId, resumeMarkdown } from './resumeDoc';

describe('resumeMarkdown', () => {
	const markdown = resumeMarkdown(DEFAULT_PROFILE, DEFAULT_PROJECTS, RESUME);

	it('이름·직함·한 줄 소개와 연락처로 시작한다', () => {
		expect(markdown.startsWith(`# ${DEFAULT_PROFILE.name} 이력서`)).toBe(true);
		expect(markdown).toContain(RESUME.motto);
		expect(markdown).toContain(DEFAULT_PROFILE.email);
	});

	it('이력서에 고른 프로젝트는 모두 지금 프로젝트 목록에 있다', () => {
		const ids = new Set(DEFAULT_PROJECTS.map((project) => project.id));
		for (const { id } of [...RESUME.featured, ...RESUME.minor]) expect(ids.has(id)).toBe(true);
	});

	it('프로젝트 이름·기간·기술은 프로젝트 데이터에서 읽고, 이름은 Safari로 가는 링크다', () => {
		const project = DEFAULT_PROJECTS.find((item) => item.id === 'macfolio')!;
		expect(markdown).toContain(`### [${project.name}](${PROJECT_LINK}macfolio)`);
		expect(markdown).toContain(project.period);
		expect(markdown).toContain(`\`${project.stack[0]}\``);
	});

	it('프로젝트를 고치면 이력서도 바뀌고, 숨긴 프로젝트는 건너뛴다', () => {
		const renamed: Project[] = DEFAULT_PROJECTS.filter((item) => item.id !== 'qru').map((item) =>
			item.id === 'macfolio' ? { ...item, name: 'MacFolio 2' } : item
		);
		const changed = resumeMarkdown(DEFAULT_PROFILE, renamed, RESUME);
		expect(changed).toContain('[MacFolio 2]');
		expect(changed).not.toContain(`${PROJECT_LINK}qru`);
	});

	it('수상·교육은 표로 그린다', () => {
		expect(markdown).toContain('## 교육');
		expect(markdown).toContain(`| **${RESUME.education[1].title}**<br>${RESUME.education[1].detail} |`);
	});
});

describe('projectLinkId', () => {
	it('프로젝트 링크면 id, 아니면 null', () => {
		expect(projectLinkId(`${PROJECT_LINK}macfolio`)).toBe('macfolio');
		expect(projectLinkId(PROJECT_LINK)).toBeNull();
		expect(projectLinkId('https://example.com')).toBeNull();
		expect(projectLinkId('docs/a.md')).toBeNull();
	});
});
