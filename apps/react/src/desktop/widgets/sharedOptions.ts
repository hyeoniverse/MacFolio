// 위젯 자리 불러오기와, 고른 값(사진 위젯의 앨범, 메모 위젯의 글 보기)을 바탕화면·휴대폰 홈 화면이 함께 쓰기.
// 두 화면은 위젯 자리를 브라우저에 따로 저장한다. 같은 위젯(같은 id·종류)의 고른 값은 한쪽에서 바꾸면 다른 쪽에도 적는다
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import {
	DEFAULT_DESKTOP_WIDGETS,
	DEFAULT_MOBILE_WIDGETS,
	fillOptions,
	parseMobileWidgets,
	parseWidgets,
	upgradeMobileDefault,
	withOptions,
	type PageWidget,
	type PlacedWidget,
	type WidgetKind,
	type WidgetOptions,
} from './catalog';
import { normalizeOrder } from '@/desktop/mobile/widgetOrder';

const readDesktop = (): PlacedWidget[] =>
	parseWidgets(readJson(STORAGE_KEYS.desktopWidgets)) ?? DEFAULT_DESKTOP_WIDGETS;
/**
 * 저장된 휴대폰 위젯. 예전 처음 구성 그대로면 지금 처음 구성으로 바꾸고(upgradeMobileDefault),
 * 페이지마다 보이는 순서로 늘어놓는다(normalizeOrder: 끌어 옮길 때 순서와 화면의 자리가 맞게)
 */
const readMobile = (): PageWidget[][] => {
	const saved = parseMobileWidgets(readJson(STORAGE_KEYS.mobileWidgets));
	return saved ? upgradeMobileDefault(saved).map(normalizeOrder) : DEFAULT_MOBILE_WIDGETS;
};

/** 바탕화면 위젯. 고르지 않은 값은 휴대폰의 같은 위젯이 고른 값으로 */
export const loadDesktopWidgets = (): PlacedWidget[] => fillOptions(readDesktop(), readMobile().flat());

/** 휴대폰 홈 화면 위젯. 고르지 않은 값은 바탕화면의 같은 위젯이 고른 값으로 */
export const loadMobileWidgets = (): PageWidget[][] => {
	const desktop = readDesktop();
	return readMobile().map((page) => fillOptions(page, desktop));
};

/** 다른 화면(지금 보이지 않는 쪽)에 저장된 같은 위젯에도 고른 값을 적는다. 지금 화면은 부르는 쪽이 저장한다 */
export function shareOptions(to: 'desktop' | 'mobile', id: string, kind: WidgetKind, options: WidgetOptions) {
	if (to === 'desktop') {
		const widgets = readDesktop();
		const next = withOptions(widgets, id, kind, options);
		if (next !== widgets) writeJson(STORAGE_KEYS.desktopWidgets, next);
		return;
	}
	const pages = readMobile();
	const next = pages.map((page) => withOptions(page, id, kind, options));
	if (next.some((page, index) => page !== pages[index])) writeJson(STORAGE_KEYS.mobileWidgets, next);
}
