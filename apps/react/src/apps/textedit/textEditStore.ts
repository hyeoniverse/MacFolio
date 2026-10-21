// 텍스트 편집기 앱에 열린 Markdown 문서 (저장소 문서·이력서). Finder에서 .md를 열거나 문서 링크를 누르면 여기에 더하고, 창이 그린다.
// 문서 안의 다른 문서 링크로 옮겨 다닌 길을 남겨 뒤로·앞으로 간다 (Finder에서 문서를 읽던 때와 같다)
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

interface TextEditState {
	/** 연 문서 경로 (예: README.md, docs/privacy.md, resume.md) */
	history: string[];
	at: number;
}

const store = createStore<TextEditState>({ history: [], at: -1 });

/** 문서를 연다 (지금 보던 것 뒤에 쌓는다). 창을 여는 일(openApp)은 부르는 쪽이 한다 */
export function openInTextEdit(path: string) {
	store.setState(({ history, at }) =>
		history[at] === path ? { history, at } : { history: [...history.slice(0, at + 1), path], at: at + 1 }
	);
}

/** 뒤로(-1)·앞으로(1) */
export const stepTextEdit = (delta: number) =>
	store.setState(({ history, at }) => ({ history, at: Math.min(history.length - 1, Math.max(0, at + delta)) }));

export function useTextEdit(): { path: string | null; canBack: boolean; canForward: boolean } {
	const { history, at } = useSyncExternalStore(store.subscribe, store.getState);
	return { path: history[at] ?? null, canBack: at > 0, canForward: at < history.length - 1 };
}

/** 열린 문서를 모두 닫는다 (창을 닫거나 앱을 끄면) */
export const resetTextEdit = () => store.setState({ history: [], at: -1 });
