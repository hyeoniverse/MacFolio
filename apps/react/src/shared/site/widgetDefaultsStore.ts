// 사이트의 위젯 기본값 (서버의 GET /site의 widgets). 관리자가 위젯에서 고른 값을 모든 방문자·기기의 기본값으로 쓴다.
// 위젯의 고른 값은 브라우저마다 따로 저장되므로(localStorage), 다른 기기(예: 아이폰 Safari)에도 보이게 서버에 둔다.
// 방문자가 자기 브라우저에서 직접 고른 값은 이 기본값보다 우선한다 (desktop/widgets/catalog.ts의 effectiveAlbum)
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import type { SiteView, WidgetDefaults } from '@macfolio/contracts';
import { api, reasonsFrom } from '@/shared/api/client';

const EMPTY: WidgetDefaults = { photoAlbum: null };

const widgetDefaultsStore = createStore<WidgetDefaults>(EMPTY);

/** 서버에 저장한 기본값을 쓴다 (앱 시작 때 shared/site/siteContent.ts가 부른다). null이면 기본값 없음 */
export const setSiteWidgetDefaults = (defaults: WidgetDefaults | null) =>
	widgetDefaultsStore.setState(defaults ?? EMPTY);

export const getSiteWidgetDefaults = () => widgetDefaultsStore.getState();

export function useSiteWidgetDefaults(): WidgetDefaults {
	return useSyncExternalStore(widgetDefaultsStore.subscribe, widgetDefaultsStore.getState);
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

/** 관리자: 위젯 기본값을 저장한다 (PUT /site/widgets). 저장한 뒤의 값을 바로 쓴다 */
export async function saveSiteWidgetDefaults(defaults: WidgetDefaults): Promise<SaveResult> {
	try {
		const body = await api<Partial<SiteView> | null>('/site/widgets', {
			method: 'PUT',
			json: defaults,
			fallback: '저장하지 못했습니다.',
		});
		setSiteWidgetDefaults(body?.widgets ?? null);
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}
