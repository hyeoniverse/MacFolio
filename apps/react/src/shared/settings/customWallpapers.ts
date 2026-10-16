// 관리자가 더한 배경화면 (apps/api의 /wallpapers). 누구나 목록을 받고, 관리자만 올리고 이름을 바꾸고 지운다.
// 기본 배경화면은 화면 모드마다(macOS·iOS) 따로지만, 더한 배경화면은 데스크톱·휴대폰 어디서나 고른다.
import { useSyncExternalStore } from 'react';
import { env } from '@/shared/config/env';
import { api, apiFetch, SIGNED_OUT } from '@/shared/api/client';
import { createStore } from '@macfolio/desktop-core';
import type { Wallpaper as ServerWallpaper } from '@macfolio/contracts';
import { settingsStore } from '@/shared/settings/settingsStore';
import {
	DEFAULT_SETTINGS,
	isCustomWallpaperId,
	isSafeImageUrl,
	type CustomWallpaperId,
	type Settings,
} from '@/shared/settings/settings';

/** 어느 화면의 배경화면인지 (mac: 데스크톱, ios: 휴대폰 홈 화면) */
export type WallpaperKind = 'mac' | 'ios';

export interface CustomWallpaper {
	/** 설정에 저장하는 id (custom:서버 id) */
	id: CustomWallpaperId;
	serverId: string;
	name: string;
	/** 전체 주소 (API 주소 + /files/:id) */
	image: string;
	thumbnail: string;
}

interface State {
	/** idle: 아직 묻지 않음, error: 서버에 닿지 못함 (기본 배경화면만 보인다) */
	status: 'idle' | 'loading' | 'ready' | 'error';
	list: CustomWallpaper[];
}

export const customWallpaperStore = createStore<State>({ status: 'idle', list: [] });

/** 서버 응답(contracts의 Wallpaper)을 설정에서 쓰는 모양으로: 경로 앞에 API 주소 */
const toCustom = (apiUrl: string, row: ServerWallpaper): CustomWallpaper => ({
	id: `custom:${row.id}`,
	serverId: row.id,
	name: row.name,
	image: `${apiUrl}${row.image}`,
	thumbnail: `${apiUrl}${row.thumbnail}`,
});

/** 설정에서 이 묶음의 배경화면 값 이름 */
const FIELDS = {
	mac: { id: 'wallpaper', image: 'wallpaperImage' },
	ios: { id: 'mobileWallpaper', image: 'mobileWallpaperImage' },
} as const satisfies Record<WallpaperKind, { id: keyof Settings; image: keyof Settings }>;

/** 고른 배경화면을 설정에 넣는다. 더한 배경화면은 이미지 주소도 함께 (다음에 열 때 바로 그린다) */
export function chooseWallpaper(kind: WallpaperKind, id: string, image: string | null = null) {
	const field = FIELDS[kind];
	settingsStore.setState({ [field.id]: id, [field.image]: image } as Partial<Settings>);
}

/** 고른 더한 배경화면이 서버에서 지워졌으면 기본값으로 돌린다 */
function reconcile(list: CustomWallpaper[]) {
	const settings = settingsStore.getState();
	for (const kind of ['mac', 'ios'] as const) {
		const selected = settings[FIELDS[kind].id];
		if (!isCustomWallpaperId(selected)) continue;
		const found = list.find((wallpaper) => wallpaper.id === selected);
		if (!found) chooseWallpaper(kind, DEFAULT_SETTINGS[FIELDS[kind].id]);
		else if (found.image !== settings[FIELDS[kind].image]) chooseWallpaper(kind, found.id, found.image);
	}
}

let pending: Promise<void> | null = null;

/** 목록을 받는다 (한 번만. 실패했으면 다음에 다시 묻는다) */
export function loadCustomWallpapers(apiUrl = env.apiUrl, fetchImpl: typeof fetch = fetch): Promise<void> {
	if (!apiUrl) return Promise.resolve();
	const { status } = customWallpaperStore.getState();
	if (status === 'ready') return Promise.resolve();
	pending ??= (async () => {
		customWallpaperStore.setState({ status: 'loading' });
		try {
			const rows = await api<ServerWallpaper[]>('/wallpapers', { apiUrl, fetchImpl });
			const list = rows.map((row) => toCustom(apiUrl, row)).filter((w) => isSafeImageUrl(w.image));
			customWallpaperStore.setState({ status: 'ready', list });
			reconcile(list);
		} catch {
			customWallpaperStore.setState({ status: 'error' });
		} finally {
			pending = null;
		}
	})();
	return pending;
}

/** 앱을 열 때: 더한 배경화면을 골라 둔 사람만 목록을 받아 지워졌는지 확인한다 */
export function checkChosenWallpapers() {
	const settings = settingsStore.getState();
	if (isCustomWallpaperId(settings.wallpaper) || isCustomWallpaperId(settings.mobileWallpaper)) {
		void loadCustomWallpapers();
	}
}

/** 원본 긴 변, 썸네일 긴 변 (기본 배경화면: 2560px, 썸네일 320px의 2배) */
const IMAGE_MAX = 2560;
const THUMB_MAX = 640;

/** 사진을 긴 변 max px 안으로 줄여 JPEG로 (더 작으면 크기는 그대로) */
async function shrink(file: Blob, max: number, quality: number): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다.'))),
			'image/jpeg',
			quality
		)
	);
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;

/** 관리자: 사진을 줄여서 올리고 목록 끝에 더한다. 실패하면 이유를 담은 Error */
export async function addCustomWallpaper(file: File, apiUrl = env.apiUrl): Promise<CustomWallpaper> {
	if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 배경화면으로 쓸 수 있습니다.');
	let image: Blob;
	let thumbnail: Blob;
	try {
		[image, thumbnail] = await Promise.all([shrink(file, IMAGE_MAX, 0.86), shrink(file, THUMB_MAX, 0.8)]);
	} catch {
		throw new Error('이 이미지를 읽지 못했습니다.');
	}
	const form = new FormData();
	form.append('name', baseName(file.name));
	form.append('image', image, `${baseName(file.name)}.jpg`);
	form.append('thumbnail', thumbnail, `${baseName(file.name)}-thumb.jpg`);
	const response = await apiFetch('/wallpapers', { method: 'POST', body: form, timeout: 0, apiUrl });
	if (response.status === 401) throw new Error(SIGNED_OUT);
	if (response.status === 413) throw new Error('이미지가 너무 큽니다.');
	if (!response.ok) throw new Error('배경화면을 올리지 못했습니다.');
	const added = toCustom(apiUrl, (await response.json()) as ServerWallpaper);
	customWallpaperStore.setState((state) => ({ ...state, list: [...state.list, added] }));
	return added;
}

/** 관리자: 이름을 바꾼다. 실패하면 이유를 담은 Error */
export async function renameCustomWallpaper(
	wallpaper: CustomWallpaper,
	name: string,
	apiUrl = env.apiUrl
): Promise<CustomWallpaper> {
	const response = await apiFetch(`/wallpapers/${encodeURIComponent(wallpaper.serverId)}`, {
		method: 'PATCH',
		json: { name },
		apiUrl,
	});
	if (response.status === 401) throw new Error(SIGNED_OUT);
	if (response.status === 400) throw new Error('이름을 입력해 주세요.');
	if (!response.ok) throw new Error('이름을 바꾸지 못했습니다.');
	const renamed = toCustom(apiUrl, (await response.json()) as ServerWallpaper);
	customWallpaperStore.setState((state) => ({
		...state,
		list: state.list.map((w) => (w.id === renamed.id ? renamed : w)),
	}));
	return renamed;
}

/** 관리자: 지운다. 지금 고른 배경화면이면 기본값으로 돌린다 */
export async function removeCustomWallpaper(wallpaper: CustomWallpaper, apiUrl = env.apiUrl): Promise<void> {
	const response = await apiFetch(`/wallpapers/${encodeURIComponent(wallpaper.serverId)}`, {
		method: 'DELETE',
		apiUrl,
	});
	if (response.status === 401) throw new Error(SIGNED_OUT);
	if (!response.ok && response.status !== 404) throw new Error('배경화면을 지우지 못했습니다.');
	customWallpaperStore.setState((state) => ({
		...state,
		list: state.list.filter((w) => w.id !== wallpaper.id),
	}));
	reconcile(customWallpaperStore.getState().list);
}

export function useCustomWallpapers(): State {
	return useSyncExternalStore(customWallpaperStore.subscribe, customWallpaperStore.getState);
}
