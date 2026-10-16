import { describe, expect, it } from 'vitest';
import { RESERVED_PROJECT_IDS } from '@macfolio/desktop-core/site';
import { APP_MANIFEST, APP_NAMES, BUILTIN_APP_NAMES, PROJECT_APPS, projectAppName } from '@/apps/manifest';
import { PROJECTS } from '@/shared/profile';

describe('프로젝트 앱은 PROJECTS에서 만든다', () => {
	it('데모 주소와 app이 있는 프로젝트만, PROJECTS 순서로 앱이 된다', () => {
		const expected = PROJECTS.filter((project) => project.app && project.demo).map((project) => project.id);
		expect(PROJECT_APPS.map((project) => project.id)).toEqual(expected);
		expect(expected).toEqual(['hyeoniverse', 'newpick', 'qru', 'whattodo', 'sproutfarm']);
	});

	it('앱 목록과 앱 정보에 들어가고, 이 사이트(MacFolio)와 데모가 없는 DevCourse는 앱이 아니다', () => {
		for (const { id, app } of PROJECT_APPS) {
			expect(APP_NAMES).toContain(id);
			expect(APP_MANIFEST[projectAppName(id)!]).toMatchObject({ label: app.label, icon: app.icon });
		}
		expect(projectAppName('macfolio')).toBeNull();
		expect(projectAppName('devcourse')).toBeNull();
	});

	it('프로젝트 앱은 모두 Dock에 고정한다', () => {
		for (const { id } of PROJECT_APPS) {
			expect(APP_MANIFEST[projectAppName(id)!]).toMatchObject({ inDock: true, inLaunchpad: false });
		}
	});
});

describe('관리자가 더하는 프로젝트의 id', () => {
	it('이 사이트의 앱 이름은 모두 프로젝트 id로 쓸 수 없다 (프로젝트 앱 이름이 곧 id)', () => {
		for (const name of BUILTIN_APP_NAMES) expect(RESERVED_PROJECT_IDS).toContain(name);
	});
});
