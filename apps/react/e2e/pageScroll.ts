import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * 바탕화면 영역(문서)이 스크롤되지 않는지: html·body가 스크롤과 튕김을 막고, 바탕(.App)이 보이는 화면 크기와 같으며,
 * 스크립트로 문서를 스크롤해도 제자리다
 */
export async function expectPageNotScrollable(page: Page) {
	const state = await page.evaluate(() => {
		const style = (el: Element) => getComputedStyle(el);
		const app = document.querySelector('.App')!.getBoundingClientRect();
		window.scrollTo(400, 400);
		document.scrollingElement!.scrollTop = 400;
		return {
			html: [style(document.documentElement).overflow, style(document.documentElement).overscrollBehaviorY],
			body: [style(document.body).overflow, style(document.body).overscrollBehaviorY],
			app: { width: Math.round(app.width), height: Math.round(app.height) },
			viewport: { width: window.innerWidth, height: window.innerHeight },
			scroll: { x: window.scrollX, y: window.scrollY },
		};
	});
	expect(state.html).toEqual(['hidden', 'none']);
	expect(state.body).toEqual(['hidden', 'none']);
	expect(state.app).toEqual(state.viewport);
	expect(state.scroll).toEqual({ x: 0, y: 0 });
}
