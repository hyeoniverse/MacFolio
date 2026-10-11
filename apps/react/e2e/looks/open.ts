// 모양(look) 시험이 함께 쓰는 것: 프로젝트 하나의 모양을 서버 덮어쓰기로 바꿔 Safari 탭을 연다
import type { Locator, Page } from '@playwright/test';
import { appWindow, enterDesktop } from '../fixtures';
import { fakeApi, type FakeApiState } from '../fakeApi';

/**
 * 가짜 API에 "이 프로젝트는 이 모양으로"를 두고 바탕 화면에 들어가 Safari의 그 탭을 연다.
 * 돌려주는 것: Safari 창, 탭 안 페이지(.safari-page, 스크롤 상자), 가짜 API 상태
 */
export async function openLook(
	page: Page,
	project: { id: string; tab: RegExp; look?: string; override?: Record<string, unknown> },
	options: { signedIn?: boolean; viewport?: { width: number; height: number } } = {}
): Promise<{ safari: Locator; panel: Locator; api: FakeApiState }> {
	if (options.viewport) await page.setViewportSize(options.viewport);
	const api = await fakeApi(page, { signedIn: options.signedIn ?? false });
	if (project.look || project.override) {
		api.siteProjects = {
			items: [{ id: project.id, override: { ...(project.look ? { look: project.look } : {}), ...project.override } }],
		};
	}
	await enterDesktop(page);
	const safari = appWindow(page, 'safari');
	await safari.getByRole('tab', { name: project.tab }).click();
	return { safari, panel: safari.locator('.safari-page'), api };
}

/** 탭 안 페이지를 위에서 몇 px 내려 본다 (window가 아니라 .safari-page가 스크롤 상자) */
export const scrollPanel = (panel: Locator, top: number) => panel.evaluate((el, value) => (el.scrollTop = value), top);
