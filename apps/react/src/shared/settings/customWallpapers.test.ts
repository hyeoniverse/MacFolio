import { beforeEach, describe, expect, it } from 'vitest';
import { customWallpaperStore, loadCustomWallpapers } from '@/shared/settings/customWallpapers';
import { DEFAULT_SETTINGS } from '@/shared/settings/settings';
import { settingsStore } from '@/shared/settings/settingsStore';

const emptyList = (async () => new Response('[]', { headers: { 'content-type': 'application/json' } })) as typeof fetch;

describe('loadCustomWallpapers', () => {
	beforeEach(() => {
		customWallpaperStore.setState({ status: 'idle', list: [] });
		settingsStore.setState(DEFAULT_SETTINGS);
	});

	it('Finder에서 고른 배경화면은 서버 목록에 없어도 그대로 둔다', async () => {
		const video = 'https://api.example.com/files/desktop/a.mp4';
		settingsStore.setState({ wallpaper: 'custom:finder-abc', wallpaperImage: video, wallpaperVideo: video });
		await loadCustomWallpapers('https://api.example.com', emptyList);
		expect(settingsStore.getState()).toMatchObject({ wallpaper: 'custom:finder-abc', wallpaperVideo: video });
	});

	it('서버에서 지워진 배경화면은 기본값으로 돌린다', async () => {
		settingsStore.setState({ wallpaper: 'custom:gone', wallpaperImage: 'https://api.example.com/files/x.jpg' });
		await loadCustomWallpapers('https://api.example.com', emptyList);
		expect(settingsStore.getState().wallpaper).toBe(DEFAULT_SETTINGS.wallpaper);
	});
});
