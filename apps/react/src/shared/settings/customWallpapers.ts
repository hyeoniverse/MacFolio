// 관리자가 더한 배경화면 (apps/api의 /wallpapers). 누구나 목록을 받고, 관리자만 올리고 이름을 바꾸고 지운다.
// 기본 배경화면은 화면 모드마다(macOS·iOS) 따로지만, 더한 배경화면은 데스크톱·휴대폰 어디서나 고른다.
import { useSyncExternalStore } from 'react';
import { env } from '@/shared/config/env';
import { api, apiFetch, SIGNED_OUT } from '@/shared/api/client';
import { createStore } from '@macfolio/desktop-core';
import { MAX_UPLOAD_BYTES, MAX_WALLPAPER_VIDEO_BYTES, type Wallpaper as ServerWallpaper } from '@macfolio/contracts';
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
	/** 전체 주소 (API 주소 + /files/:id). 동영상 배경화면이면 MP4 주소 */
	image: string;
	/** 동영상 배경화면이면 포스터(첫 장면) */
	thumbnail: string;
	/** image가 MP4 동영상인지 */
	video: boolean;
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
	// 서버 응답을 그대로 받으니(파싱하지 않는다) 없으면 사진으로 본다
	video: row.video === true,
});

/** 설정에서 이 묶음의 배경화면 값 이름 */
const FIELDS = {
	mac: { id: 'wallpaper', image: 'wallpaperImage', video: 'wallpaperVideo' },
	ios: { id: 'mobileWallpaper', image: 'mobileWallpaperImage', video: 'mobileWallpaperVideo' },
} as const satisfies Record<WallpaperKind, { id: keyof Settings; image: keyof Settings; video: keyof Settings }>;

/** 고른 기본 배경화면을 설정에 넣는다 */
export function chooseWallpaper(kind: WallpaperKind, id: string) {
	const field = FIELDS[kind];
	settingsStore.setState({ [field.id]: id, [field.image]: null, [field.video]: null } as Partial<Settings>);
}

/** 설정에 넣을 이미지·동영상 주소. 동영상이면 배경 이미지는 포스터 (동영상을 틀기 전·못 틀 때 보인다) */
const sources = (wallpaper: CustomWallpaper) =>
	wallpaper.video
		? { image: wallpaper.thumbnail, video: wallpaper.image }
		: { image: wallpaper.image, video: null as string | null };

/** 더한 배경화면을 고른다. 이미지(동영상) 주소도 함께 넣어 다음에 열 때 서버에 묻기 전에 바로 그린다 */
export function chooseCustomWallpaper(kind: WallpaperKind, wallpaper: CustomWallpaper) {
	const field = FIELDS[kind];
	const { image, video } = sources(wallpaper);
	settingsStore.setState({ [field.id]: wallpaper.id, [field.image]: image, [field.video]: video } as Partial<Settings>);
}

/** Finder에서 '데스크탑 사진 설정'으로 고른 배경화면의 id 앞부분. 서버 목록에 없으니 맞춰 보지 않는다 */
export const FINDER_WALLPAPER_PREFIX = 'custom:finder-';

/** 고른 더한 배경화면이 서버에서 지워졌으면 기본값으로 돌린다 */
function reconcile(list: CustomWallpaper[]) {
	const settings = settingsStore.getState();
	for (const kind of ['mac', 'ios'] as const) {
		const selected = settings[FIELDS[kind].id];
		if (!isCustomWallpaperId(selected) || selected.startsWith(FINDER_WALLPAPER_PREFIX)) continue;
		const found = list.find((wallpaper) => wallpaper.id === selected);
		if (!found) {
			chooseWallpaper(kind, DEFAULT_SETTINGS[FIELDS[kind].id]);
			continue;
		}
		const { image, video } = sources(found);
		if (image !== settings[FIELDS[kind].image] || video !== settings[FIELDS[kind].video]) {
			chooseCustomWallpaper(kind, found);
		}
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
			const list = rows
				.map((row) => toCustom(apiUrl, row))
				.filter((w) => isSafeImageUrl(w.image) && isSafeImageUrl(w.thumbnail));
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
	const fromServer = (id: string) => isCustomWallpaperId(id) && !id.startsWith(FINDER_WALLPAPER_PREFIX);
	if (fromServer(settings.wallpaper) || fromServer(settings.mobileWallpaper)) {
		void loadCustomWallpapers();
	}
}

/** 원본 긴 변, 썸네일 긴 변 (기본 배경화면: 2560px, 썸네일 320px의 2배) */
const IMAGE_MAX = 2560;
const THUMB_MAX = 640;
/** 동영상의 포스터 긴 변. 움직임 줄이기를 켠 사람에게는 이 한 장이 배경이라 썸네일보다 크게 */
const POSTER_MAX = 1280;

/** 그림(사진·GIF 첫 장면·동영상 한 장면)을 긴 변 max px 안으로 줄여 JPEG로 (더 작으면 크기는 그대로) */
function toJpeg(source: CanvasImageSource, width: number, height: number, max: number, quality: number): Promise<Blob> {
	const scale = Math.min(1, max / Math.max(width, height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다.'))),
			'image/jpeg',
			quality
		)
	);
}

/** 사진을 줄여 JPEG로 */
async function shrink(file: Blob, max: number, quality: number): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	try {
		return await toJpeg(bitmap, bitmap.width, bitmap.height, max, quality);
	} finally {
		bitmap.close();
	}
}

/** 동영상에서 포스터로 쓸 장면을 고르는 시점 (처음이 검은 화면인 영상이 많아 조금 뒤) */
const POSTER_AT = 0.5;
/** 브라우저가 이 동영상을 못 읽으면 기다리지 않는다 */
const POSTER_TIMEOUT_MS = 8000;

/** MP4의 한 장면을 캔버스에 그려 포스터 JPEG로. 브라우저가 이 코덱을 못 풀면 실패한다 */
export async function videoPoster(file: Blob, max = POSTER_MAX): Promise<Blob> {
	const url = URL.createObjectURL(file);
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	try {
		await new Promise<void>((resolve, reject) => {
			const timer = window.setTimeout(() => reject(new Error('timeout')), POSTER_TIMEOUT_MS);
			video.addEventListener('error', () => reject(new Error('decode')), { once: true });
			video.addEventListener(
				'loadeddata',
				() => {
					const at = Number.isFinite(video.duration) ? Math.min(POSTER_AT, video.duration / 2) : 0;
					if (at <= 0) {
						window.clearTimeout(timer);
						resolve();
						return;
					}
					video.addEventListener(
						'seeked',
						() => {
							window.clearTimeout(timer);
							resolve();
						},
						{ once: true }
					);
					video.currentTime = at;
				},
				{ once: true }
			);
			video.src = url;
		});
		if (!video.videoWidth || !video.videoHeight) throw new Error('empty');
		return await toJpeg(video, video.videoWidth, video.videoHeight, max, 0.82);
	} finally {
		video.removeAttribute('src');
		video.load();
		URL.revokeObjectURL(url);
	}
}

/** 포스터를 못 만들 때(코덱을 못 푸는 브라우저) 대신 쓰는 어두운 그림. 고르기 칸에는 재생 표시가 함께 보인다 */
function placeholderPoster(): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 400;
	const context = canvas.getContext('2d')!;
	const gradient = context.createLinearGradient(0, 0, 640, 400);
	gradient.addColorStop(0, '#1c1c2e');
	gradient.addColorStop(1, '#3a3a5c');
	context.fillStyle = gradient;
	context.fillRect(0, 0, 640, 400);
	return toJpeg(canvas, 640, 400, 640, 0.8);
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;
const MB = 1024 * 1024;

/** 올릴 원본과 썸네일. 사진은 줄여서 JPEG로, 움직이는 GIF와 MP4는 원본 그대로 (줄이면 한 장면만 남는다) */
async function prepare(file: File): Promise<{ image: Blob; imageName: string; thumbnail: Blob }> {
	const name = baseName(file.name);
	if (file.type === 'video/mp4') {
		if (file.size > MAX_WALLPAPER_VIDEO_BYTES) {
			throw new Error(`동영상은 ${MAX_WALLPAPER_VIDEO_BYTES / MB}MB까지 올릴 수 있습니다.`);
		}
		const thumbnail = await videoPoster(file).catch(() => placeholderPoster());
		return { image: file, imageName: `${name}.mp4`, thumbnail };
	}
	if (!file.type.startsWith('image/')) {
		throw new Error('이미지나 MP4 동영상만 배경화면으로 쓸 수 있습니다.');
	}
	const gif = file.type === 'image/gif';
	if (gif && file.size > MAX_UPLOAD_BYTES) throw new Error(`GIF는 ${MAX_UPLOAD_BYTES / MB}MB까지 올릴 수 있습니다.`);
	try {
		if (gif) return { image: file, imageName: `${name}.gif`, thumbnail: await shrink(file, THUMB_MAX, 0.8) };
		const [image, thumbnail] = await Promise.all([shrink(file, IMAGE_MAX, 0.86), shrink(file, THUMB_MAX, 0.8)]);
		return { image, imageName: `${name}.jpg`, thumbnail };
	} catch (reason) {
		throw new Error('이 이미지를 읽지 못했습니다.', { cause: reason });
	}
}

/** 관리자: 사진은 줄여서, GIF·MP4는 그대로 올리고 목록 끝에 더한다. 실패하면 이유를 담은 Error */
export async function addCustomWallpaper(file: File, apiUrl = env.apiUrl): Promise<CustomWallpaper> {
	const { image, imageName, thumbnail } = await prepare(file);
	const form = new FormData();
	form.append('name', baseName(file.name));
	form.append('image', image, imageName);
	form.append('thumbnail', thumbnail, `${baseName(file.name)}-thumb.jpg`);
	const response = await apiFetch('/wallpapers', { method: 'POST', body: form, timeout: 0, apiUrl });
	if (response.status === 401) throw new Error(SIGNED_OUT);
	if (response.status === 413) throw new Error('파일이 너무 큽니다.');
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
