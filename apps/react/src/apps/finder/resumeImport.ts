// 이력서 편집기의 '불러오기': 시스템 설정의 프로필·프로젝트를 이력서 Markdown에 넣는다. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 넣은 뒤로는 이력서 글의 일부라 자동으로 따라 바뀌지 않는다 (이력서의 원본은 이 글 하나). 다시 불러오면 그때의 값으로 바뀐다.
import type { Project } from '@/shared/profile';
import type { SiteProfile } from '@/shared/site/profileStore';
import { PROJECT_LINK } from './resumeModel';

/** 주소에서 앞의 https://, www.를 뗀 보기용 글자 */
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** 첫 ## 앞(머리)과 나머지 */
function splitHead(markdown: string): { head: string; rest: string } {
	const at = markdown.search(/^## /m);
	return at < 0 ? { head: markdown, rest: '' } : { head: markdown.slice(0, at), rest: markdown.slice(at) };
}

/**
 * 프로필 불러오기: 머리(이름·직함·연락처)를 프로필로 바꾼다. 한 줄 소개는 프로필에 없어 지금 글의 것을 그대로 두고,
 * 직함은 지금 글에 있으면 그것을(이력서용으로 고쳐 쓴 직함), 없으면 프로필의 직무를 쓴다
 */
export function importProfile(markdown: string, profile: SiteProfile, site: string): string {
	const { head, rest } = splitHead(markdown);
	const role = /^\*\*(.+)\*\*\s*$/m.exec(head)?.[1] ?? profile.role;
	const motto = /^>\s*(.+)$/m.exec(head)?.[1];
	const contact = [profile.email, bare(profile.github), site].filter(Boolean).join(' · ');
	const lines = [`# ${profile.name}`, '', ...(role ? [`**${role}**`, ''] : []), ...(motto ? [`> ${motto}`, ''] : [])];
	return `${[...lines, contact].join('\n')}\n\n${rest}`.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** 프로젝트 머리 줄과 설명·기술 줄 (성과는 넣지 않는다: 이력서에 맞게 직접 쓴다) */
function projectHead(project: Project): string[] {
	const head = [`[${project.name}](${PROJECT_LINK}${encodeURIComponent(project.id)})`, project.period, project.context]
		.filter(Boolean)
		.join(' | ');
	return [
		`### ${head}`,
		'',
		[project.description, project.demo].filter(Boolean).join(' '),
		'',
		project.stack.map((tool) => `\`${tool}\``).join(' '),
	];
}

/** 이 프로젝트의 ### 줄 위치. 없으면 -1 */
const findProject = (lines: string[], id: string) =>
	lines.findIndex((line) => line.startsWith('### ') && line.includes(`(${PROJECT_LINK}${encodeURIComponent(id)})`));

/**
 * 프로젝트 불러오기. 이미 있으면 머리 줄·설명·기술 줄만 지금 값으로 바꾸고 성과는 그대로 둔다.
 * 없으면 프로젝트 절(### 이 있는 첫 ## 절)의 끝에, 그런 절이 없으면 '## 프로젝트' 절을 새로 만들어 맨 끝에 더한다
 */
export function importProject(markdown: string, project: Project): { markdown: string; replaced: boolean } {
	const lines = markdown.replace(/\r\n?/g, '\n').trimEnd().split('\n');
	const head = projectHead(project);
	const at = findProject(lines, project.id);
	if (at >= 0) {
		// 머리 줄부터 첫 성과(- ) 또는 다음 절·프로젝트 앞까지가 바꿀 부분
		let end = at + 1;
		while (end < lines.length && !/^(- |### |## )/.test(lines[end])) end++;
		lines.splice(at, end - at, ...head, '');
		return {
			markdown: `${lines
				.join('\n')
				.replace(/\n{3,}/g, '\n\n')
				.trimEnd()}\n`,
			replaced: true,
		};
	}
	const block = [...head, '', '- **성과 제목** — 이 프로젝트에서 한 일과 결과를 씁니다'];
	const firstProject = lines.findIndex((line) => line.startsWith('### '));
	if (firstProject >= 0) {
		// 그 절의 끝: 다음 ## 앞
		let end = lines.findIndex((line, index) => index > firstProject && line.startsWith('## '));
		if (end < 0) end = lines.length;
		while (end > 0 && lines[end - 1].trim() === '') end--;
		lines.splice(end, 0, '', ...block);
	} else lines.push('', '## 프로젝트', '', ...block);
	return { markdown: `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`, replaced: false };
}
