import { afterEach, describe, expect, it } from 'vitest';
import { parseProjects } from '@macfolio/desktop-core/site';
import { DEFAULT_PROJECTS, PROJECTS } from '@/shared/profile';
import { getProfile } from './profileStore';
import { applySiteContent, getSavedProjects } from './siteContent';

afterEach(() => applySiteContent({}));

describe('코드의 프로젝트도 서버와 같은 규칙에 맞는다', () => {
	it('모든 기본 프로젝트를 덮어쓰기로 보내도 검사를 통과한다 (고급 JSON으로 그대로 저장할 수 있다)', () => {
		const parsed = parseProjects({ items: DEFAULT_PROJECTS.map(({ id, ...override }) => ({ id, override })) });
		expect('errors' in parsed ? parsed.errors : []).toEqual([]);
	});
});

describe('applySiteContent', () => {
	it('프로젝트를 서버 순서대로 합치되, PROJECTS 배열은 바꾸지 않고 안을 채운다 (먼저 읽어 간 모듈도 같은 배열)', () => {
		const before = PROJECTS;
		applySiteContent({
			profile: null,
			projects: {
				items: [
					{ id: 'devcourse', override: { name: '데브코스' } },
					{ id: 'hyeoniverse', hidden: true },
				],
			},
		});
		expect(PROJECTS).toBe(before);
		expect(PROJECTS[0]).toMatchObject({ id: 'devcourse', name: '데브코스' });
		expect(PROJECTS.some((project) => project.id === 'hyeoniverse')).toBe(false);
		expect(PROJECTS).toHaveLength(DEFAULT_PROJECTS.length - 1);
		expect(getSavedProjects()?.items).toHaveLength(2);
	});

	it('규칙에 맞지 않는 값이나 빈 값은 버리고 코드의 기본값', () => {
		applySiteContent({ profile: { name: '' }, projects: { items: [{ id: 'safari' }] } });
		expect(PROJECTS.map((project) => project.id)).toEqual(DEFAULT_PROJECTS.map((project) => project.id));
		expect(getProfile().name).toBe('김정현');
		expect(getSavedProjects()).toBeNull();
	});
});
