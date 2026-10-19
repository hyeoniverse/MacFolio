// macOS Finder의 '데스크탑 사진 설정': 그림 파일을 오른쪽 클릭해 바로 바탕화면으로 둔다 (이 브라우저의 설정).
import { settingsStore } from '@/shared/settings/settingsStore';
import type { Settings } from '@/shared/settings/settings';
import { fileUrl } from './documents';
import type { FinderItem } from './files';

/** 바탕화면으로 둘 수 있는 항목: 그림 파일 */
export const canSetWallpaper = (item: FinderItem | null | undefined) => item?.kind === 'image';

/** 짧은 해시 (같은 파일이면 같은 id) */
const hash = (text: string) => {
	let value = 0;
	for (const char of text) value = (Math.imul(value, 31) + char.charCodeAt(0)) | 0;
	return (value >>> 0).toString(36);
};

/**
 * 그림을 데스크톱 바탕화면으로. 주소는 절대 주소(https://…/files/…, 사이트의 /imgs/…).
 * 방문자가 놓은 파일(blob:)은 이 탭에서만 보이고, 새로고침하면 설정을 읽을 때 기본 배경화면으로 돌아간다
 */
export function setDesktopWallpaper(item: FinderItem) {
	if (item.kind !== 'image') return;
	const url = fileUrl(item.key);
	const image = url.startsWith('blob:') ? url : new URL(url, window.location.origin).href;
	settingsStore.setState({
		wallpaper: `custom:finder-${hash(item.key)}`,
		wallpaperImage: image,
		wallpaperVideo: null,
	} as Partial<Settings>);
}
