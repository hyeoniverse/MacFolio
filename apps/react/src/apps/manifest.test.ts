import { describe, expect, it } from 'vitest';
import { APP_MANIFEST, APP_NAMES, PROJECT_APPS, projectAppName } from '@/apps/manifest';
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

	it('Dock에 고정한 새싹 농장 말고는 Launchpad에 둔다', () => {
		expect(APP_MANIFEST[projectAppName('sproutfarm')!]).toMatchObject({ inDock: true, inLaunchpad: false });
		expect(APP_MANIFEST[projectAppName('newpick')!]).toMatchObject({ inDock: false, inLaunchpad: true });
	});
});
