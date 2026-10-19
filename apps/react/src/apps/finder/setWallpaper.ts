// macOS Finder의 '데스크탑 사진 설정': 그림 파일을 오른쪽 클릭해 바로 바탕화면으로 둔다 (이 브라우저의 설정).
import { settingsStore } from '@/shared/settings/settingsStore';
import type { Settings } from '@/shared/settings/settings';
import { FINDER_WALLPAPER_PREFIX } from '@/shared/settings/customWallpapers';
import { fileUrl } from './documents';
import { mediaKind, type FinderItem } from './files';

const isVideo = (item: FinderItem) => item.kind === 'file' && mediaKind(item.name) === 'video';

/** 바탕화면으로 둘 수 있는 항목: 그림 파일과 동영상 파일 */
export const canSetWallpaper = (item: FinderItem | null | undefined) =>
	!!item && (item.kind === 'image' || isVideo(item));

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
	if (!canSetWallpaper(item) || !('key' in item)) return;
	const url = fileUrl(item.key);
	const src = url.startsWith('blob:') ? url : new URL(url, window.location.origin).href;
	// 동영상은 포스터가 따로 없어서 배경 이미지 자리에도 같은 주소를 둔다 (그림으로는 안 그려지고 동영상이 위에 깔린다)
	settingsStore.setState({
		wallpaper: `${FINDER_WALLPAPER_PREFIX}${hash(item.key)}`,
		wallpaperImage: src,
		wallpaperVideo: isVideo(item) ? src : null,
	} as Partial<Settings>);
}
