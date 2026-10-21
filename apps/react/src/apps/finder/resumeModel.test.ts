import { describe, expect, it } from 'vitest';
import DEFAULT from '@/shared/profile/resume.md?raw';
import { parseResume, projectLinkId, PROJECT_LINK } from './resumeModel';

describe('parseResume', () => {
	const resume = parseResume(DEFAULT);

	it('머리: 이름·직함·한 줄 소개·연락처', () => {
		expect(resume.name).toBe('김정현');
		expect(resume.role).toBe('웹 개발자 · 프론트엔드 중심 풀스택');
		expect(resume.motto).toBe('화면에서 서버까지, 끝까지 만들고 운영하는 개발자');
		expect(resume.contact).toEqual(['hyeoniverse.dev@gmail.com', 'github.com/hyeoniverse', 'macfolio.hyeoniverse.com']);
	});

	it('절의 모양: 첫 목록은 카드, 날짜가 있으면 줄, ###이 있으면 프로젝트, 나머지는 목록', () => {
		expect(resume.sections.map((section) => [section.title, section.kind])).toEqual([
			['강점', 'cards'],
			['할 수 있는 일', 'list'],
			['프로젝트', 'projects'],
			['그 밖의 프로젝트', 'rows'],
			['수상 · 자격 · 어학', 'rows'],
			['교육', 'rows'],
		]);
	});

	it('목록: 제목 — 설명, 끝의 `코드`는 기술, | 날짜', () => {
		const skills = resume.sections[1];
		expect(skills.kind === 'list' && skills.entries[0]).toMatchObject({
			title: '화면 개발',
			detail: expect.stringContaining('컴포넌트·훅'),
			tools: expect.arrayContaining(['React', 'TypeScript']),
		});
		const awards = resume.sections[4];
		expect(awards.kind === 'rows' && awards.entries[2]).toEqual({
			title: '정보처리기사 · 한국산업인력공단',
			period: '2024.06',
			tools: [],
		});
		const more = resume.sections[3];
		expect(more.kind === 'rows' && more.entries[0]).toMatchObject({
			title: 'WTD (What To Do)',
			projectId: 'whattodo',
			period: '2024.10 · 팀 7인',
		});
	});

	it('프로젝트: [이름](#project/id) | 기간 | 구분, 설명(주소는 따로), 기술 줄, 성과', () => {
		const section = resume.sections[2];
		if (section.kind !== 'projects') throw new Error('프로젝트 절이 아니다');
		expect(section.projects.map((project) => project.projectId)).toEqual(['macfolio', 'hyeoniverse', 'newpick', 'qru']);
		expect(section.projects[0]).toMatchObject({
			name: 'MacFolio',
			meta: ['2024.10 –', '개인 · 운영 중'],
			url: 'https://macfolio.hyeoniverse.com',
			stack: ['React', 'TypeScript', 'Vite', 'NestJS', 'PostgreSQL', 'Cloudflare'],
		});
		expect(section.projects[0].description).not.toContain('https://');
		expect(section.projects[0].bullets[0]).toEqual({
			title: '창 관리와 반응형 셸',
			detail: expect.stringContaining('iOS 홈 화면'),
		});
	});

	it('규칙에 맞지 않는 절도 버리지 않고 글로 남긴다, 줄바꿈 \\r\\n도 받는다', () => {
		const odd = parseResume('# 이름\r\n\r\n## 자기소개\r\n그냥 문장입니다.\r\n- 목록도 섞임');
		expect(odd.name).toBe('이름');
		expect(odd.sections).toEqual([{ kind: 'text', title: '자기소개', lines: ['그냥 문장입니다.', '- 목록도 섞임'] }]);
	});
});

describe('projectLinkId', () => {
	it('프로젝트 링크면 id, 아니면 null', () => {
		expect(projectLinkId(`${PROJECT_LINK}macfolio`)).toBe('macfolio');
		expect(projectLinkId(PROJECT_LINK)).toBeNull();
		expect(projectLinkId('https://example.com')).toBeNull();
	});
});
