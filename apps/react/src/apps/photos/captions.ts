// 사진 캡션 (#21): 원래 캡션은 프로젝트 정보(shared/profile.ts)에 있고, 관리자가 고친 것만 서버(GET·PUT /photos/captions)에 둔다.
// 앱이 열릴 때 한 번 받아 두고, 관리자가 고치면 서버가 돌려준 전체로 바꾼다
import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';
import { env } from '@/shared/config/env';
import type { Photo } from './albums';

const captions = createStore<{ map: Record<string, string> }>({ map: {} });
let requested = false;

/** 고친 캡션을 받아 둔다 (한 번만. 서버가 없거나 닿지 않으면 원래 캡션을 쓴다) */
export function loadCaptions() {
	if (requested || !env.apiUrl) return;
	requested = true;
	fetch(`${env.apiUrl}/photos/captions`, { credentials: 'include', signal: AbortSignal.timeout(15_000) })
		.then((response) => (response.ok ? (response.json() as Promise<Record<string, string>>) : {}))
		.then((map) => captions.setState({ map }))
		.catch(() => {
			requested = false;
		});
}

export const useCaptions = () => useSyncExternalStore(captions.subscribe, () => captions.getState().map);

/** 보여 줄 캡션: 관리자가 고친 것, 없으면 원래 캡션 */
export const captionOf = (photo: Photo, map: Record<string, string>) => map[photo.src] ?? photo.caption;

/** 관리자: 캡션 하나를 고친다. 비우면 원래 캡션으로 돌아간다 */
export async function saveCaption(src: string, caption: string): Promise<void> {
	const response = await fetch(`${env.apiUrl}/photos/captions`, {
		method: 'PUT',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ src, caption }),
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
		const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
		throw new Error(message || '캡션을 저장하지 못했습니다.');
	}
	captions.setState({ map: (await response.json()) as Record<string, string> });
}
