// 클릭 소리를 낼지 정하는 규칙. DOM 이벤트 대신 필요한 값만 받는 순수 함수로 둔다.

export type ClickPhase = 'down' | 'up';

export interface ClickInput {
	/** PointerEvent.pointerType: mouse, pen, touch */
	pointerType: string;
	/** 누른 단추 (0: 주 단추) */
	button: number;
	/** 로딩 화면 위에서 눌렀는지 (그때는 시작음이 나므로 딸깍 소리를 내지 않는다) */
	onLoadingScreen: boolean;
	/** 설정의 클릭 소리 */
	enabled: boolean;
}

/**
 * macOS처럼 마우스·펜의 주 단추에만 소리를 낸다.
 * 휴대폰 터치는 기기가 알아서 촉감으로 알려 주고, 누를 때마다 소리가 나면 시끄러워서 뺀다.
 */
export function shouldPlayClick({ pointerType, button, onLoadingScreen, enabled }: ClickInput): boolean {
	if (!enabled || onLoadingScreen) return false;
	if (pointerType !== 'mouse' && pointerType !== 'pen') return false;
	return button === 0;
}

/** 누를 때·뗄 때의 소리 파일 (public/sounds) */
export const CLICK_SOUND_FILES: Record<ClickPhase, string> = {
	down: 'mouse-down.mp3',
	up: 'mouse-up.mp3',
};
