// 이력서 문서. 파일로 올리지 않고 프로필·프로젝트·이력서 데이터로 Markdown을 만들어 Finder의 문서 › 이력서에 둔다.
// 프로젝트를 고치면(관리자가 시스템 설정에서 고친 것까지) 이력서도 함께 바뀐다. React와 DOM에 의존하지 않는 순수 함수만 둔다.
import type { Project } from '@/shared/profile';
import type { ResumeContent } from '@/shared/profile/resume';
import type { SiteProfile } from '@/shared/site/profileStore';

/** Finder 안의 문서 경로 (저장소 문서와 겹치지 않는 이름) */
export const RESUME_DOC = 'resume.md';

/** 이력서 안 프로젝트 링크의 앞부분. 누르면 Safari의 그 프로젝트를 연다 (DocView) */
export const PROJECT_LINK = '#project/';

/** 링크가 가리키는 프로젝트 id. 프로젝트 링크가 아니면 null */
export const projectLinkId = (href: string): string | null =>
	href.startsWith(PROJECT_LINK) ? decodeURIComponent(href.slice(PROJECT_LINK.length)) || null : null;

const link = (project: Pick<Project, 'id' | 'name'>) =>
	`[${project.name}](${PROJECT_LINK}${encodeURIComponent(project.id)})`;

/** 프로젝트 줄의 꼬리: 구분 · 기간 */
const meta = (project: Project) => [project.context, project.period].filter(Boolean).join(' · ');

/** 이력서 Markdown. 숨기거나 지운 프로젝트(PROJECTS에 없는 id)는 건너뛴다 */
export function resumeMarkdown(profile: SiteProfile, projects: readonly Project[], resume: ResumeContent): string {
	const byId = new Map(projects.map((project) => [project.id, project]));
	const lines: string[] = [
		`# ${profile.name} 이력서`,
		'',
		`**${resume.role}**`,
		'',
		`> ${resume.motto}`,
		'',
		`${profile.email} · ${profile.github}`,
		'',
		'## 강점',
		'',
		...resume.strengths.map((item) => `- **${item.title}** — ${item.detail}`),
		'',
		'## 할 수 있는 일',
		'',
		...resume.capabilities.map((item) => `- **${item.area}** — ${item.detail} _(${item.tools.join(', ')})_`),
		'',
		'## 프로젝트',
	];

	for (const { id, bullets } of resume.featured) {
		const project = byId.get(id);
		if (!project) continue;
		lines.push(
			'',
			`### ${link(project)}`,
			'',
			`${project.description}  `,
			`_${meta(project)}_  `,
			`\`${project.stack.join('` `')}\``,
			'',
			...bullets.map((bullet) => `- **${bullet.title}** — ${bullet.detail}`)
		);
	}

	const minor = resume.minor.flatMap(({ id, line }) => {
		const project = byId.get(id);
		return project ? [`- ${link(project)} — ${line} _(${meta(project)})_`] : [];
	});
	if (minor.length) lines.push('', '### 그 밖의 프로젝트', '', ...minor);

	const entries = (items: ResumeContent['awards']) =>
		items.map((item) => `| **${item.title}**${item.detail ? `<br>${item.detail}` : ''} | ${item.period} |`);
	lines.push(
		'',
		'## 수상 · 자격 · 어학',
		'',
		'| 항목 | 날짜 |',
		'| --- | --- |',
		...entries(resume.awards),
		'',
		'## 교육',
		'',
		'| 과정 | 기간 |',
		'| --- | --- |',
		...entries(resume.education),
		''
	);
	return lines.join('\n');
}
