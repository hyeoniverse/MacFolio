import { createStore } from '@macfolio/desktop-core';

/**
 * 다른 곳(이 Mac에 관하여·시스템 설정의 정보에 있는 이메일)에서 메일 앱의 '새로운 메시지'를 열어 달라는 요청.
 * 메일 앱이 읽고 비운다 (앱이 이미 열려 있어도 구독하고 있어서 바로 연다)
 */
export const composeRequest = createStore<{ pending: boolean }>({ pending: false });

/** 이 요청을 한 번 받아 처리한다 (지금 있는 요청도) */
export function takeComposeRequest(open: () => void) {
	const take = ({ pending }: { pending: boolean }) => {
		if (!pending) return;
		composeRequest.setState({ pending: false });
		open();
	};
	take(composeRequest.getState());
	return composeRequest.subscribe(take);
}
