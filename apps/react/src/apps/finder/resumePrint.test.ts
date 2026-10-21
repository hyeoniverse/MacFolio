import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTS } from '@/shared/profile';
import { RESUME } from '@/shared/profile/resume';
import { DEFAULT_PROFILE } from '@/shared/site/profileStore';
import { resumeHtml } from './resumePrint';

describe('resumeHtml', () => {
	const html = resumeHtml(
		DEFAULT_PROFILE,
		DEFAULT_PROJECTS,
		RESUME,
		'macfolio.example.com',
		'https://example.com/me.png'
	);

	it('A4 인쇄 문서: 제목은 PDF 파일 이름이 되고, 다크 모드와 상관없이 흰 바탕', () => {
		expect(html).toContain(`<title>${DEFAULT_PROFILE.name}_이력서</title>`);
		expect(html).toContain('@page { size: A4;');
		expect(html).toContain('color-scheme: light');
	});

	it('사진·연락처·강점·프로젝트·수상·교육을 데이터에서 그린다', () => {
		expect(html).toContain('<img class="photo" src="https://example.com/me.png"');
		expect(html).toContain('macfolio.example.com');
		for (const item of RESUME.strengths) expect(html).toContain(item.title);
		expect(html).toContain('<h3>MacFolio</h3>');
		expect(html).toContain(RESUME.education[1].detail!);
	});

	it('글자는 HTML로 풀리지 않게 바꾸고, 숨긴 프로젝트는 건너뛴다', () => {
		const projects = DEFAULT_PROJECTS.filter((project) => project.id !== 'qru').map((project) =>
			project.id === 'macfolio' ? { ...project, name: '<script>x</script>' } : project
		);
		const changed = resumeHtml(DEFAULT_PROFILE, projects, RESUME, 'site');
		expect(changed).toContain('&lt;script&gt;x&lt;/script&gt;');
		expect(changed).not.toContain('<script>');
		expect(changed).not.toContain('QRU');
		expect(changed).not.toContain('class="photo"');
	});
});
