// 미리보기 앱에 열린 파일. Finder에서 PDF·그림을 열면 여기에 더하고, 미리보기 창이 그린다.
// 창이 아직 한 번도 열리지 않았어도 목록이 남아 있다가, 창이 뜨면 그대로 보인다.
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

export interface PreviewFile {
	/** R2 키 (/files/<key>). 같은 파일을 두 번 열면 하나로 친다 */
	key: string;
	name: string;
	kind: 'pdf' | 'image';
	size?: number;
}

interface PreviewState {
	files: PreviewFile[];
	current: string | null;
}

const store = createStore<PreviewState>({ files: [], current: null });

/** 파일을 연다. 이미 열려 있으면 그 파일로 간다. 창을 여는 일(openApp)은 부르는 쪽이 한다 */
export function openInPreview(file: PreviewFile) {
	store.setState((state) => ({
		files: state.files.some((open) => open.key === file.key) ? state.files : [...state.files, file],
		current: file.key,
	}));
}

/** 파일을 보기에서 뺀다. 보던 파일이면 옆 파일로 간다 */
export function closeInPreview(key: string) {
	store.setState((state) => {
		const at = state.files.findIndex((file) => file.key === key);
		const files = state.files.filter((file) => file.key !== key);
		const current = state.current === key ? (files[Math.min(at, files.length - 1)]?.key ?? null) : state.current;
		return { files, current };
	});
}

export const selectInPreview = (key: string) => store.setState({ current: key });

export function usePreview(): PreviewState {
	return useSyncExternalStore(store.subscribe, store.getState);
}

/** 열린 파일을 모두 뺀다. 창을 닫거나 앱을 끄면 다음에 열 때 열기 창부터 (macOS 미리보기처럼) */
export const resetPreview = () => store.setState({ files: [], current: null });
