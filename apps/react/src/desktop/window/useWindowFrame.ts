import { useRef, useState } from 'react';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { useViewport } from '@/shared/hooks/useViewport';
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import {
	clampRect,
	defaultRect,
	maximizedRect,
	moveRect,
	resizeRect,
	type Rect,
	type ResizeDirection,
} from '@/desktop/window/geometry';

const loadRect = (appName: AppName) => readJson(STORAGE_KEYS.window(appName)) as Rect | null;
/** 저장하지 못해도 동작에는 문제없다 */
const saveRect = (appName: AppName, rect: Rect) => writeJson(STORAGE_KEYS.window(appName), rect);

type GestureKind = { kind: 'move' } | { kind: 'resize'; direction: ResizeDirection };
type Gesture = GestureKind & { pointerX: number; pointerY: number; start: Rect };

/**
 * 창의 위치·크기와 드래그·크기 조절·최대화를 관리한다.
 * pointer 이벤트와 pointer capture를 써서 마우스와 터치를 함께 처리한다.
 */
export function useWindowFrame(appName: AppName) {
	const viewport = useViewport();
	const { windowSize, minSize } = APP_MANIFEST[appName];
	const [savedRect, setSavedRect] = useState<Rect>(
		() => loadRect(appName) ?? defaultRect(viewport, windowSize, minSize)
	);
	const [isMaximized, setIsMaximized] = useState(false);
	const gesture = useRef<Gesture | null>(null);

	// 렌더링할 때마다 화면 안으로 제한한다. 브라우저 크기가 줄어도 창이 화면 밖에 남지 않는다.
	const rect = isMaximized ? maximizedRect(viewport) : clampRect(savedRect, viewport, minSize);

	const nextRect = (current: Gesture, event: React.PointerEvent) => {
		const dx = event.clientX - current.pointerX;
		const dy = event.clientY - current.pointerY;
		return current.kind === 'move'
			? moveRect(current.start, dx, dy, viewport, minSize)
			: resizeRect(current.start, current.direction, dx, dy, viewport, minSize);
	};

	const begin = (event: React.PointerEvent, next: GestureKind) => {
		// 최대화 중에는 옮기지 않고, 제목 표시줄 안의 버튼(닫기 등)을 누른 경우도 무시한다
		if (isMaximized || (event.target as Element).closest('button, [role="button"]')) return;
		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		gesture.current = { ...next, pointerX: event.clientX, pointerY: event.clientY, start: rect };
	};

	const handlers = {
		onPointerMove: (event: React.PointerEvent) => {
			if (gesture.current) setSavedRect(nextRect(gesture.current, event));
		},
		onPointerUp: (event: React.PointerEvent) => {
			if (!gesture.current) return;
			const final = nextRect(gesture.current, event);
			gesture.current = null;
			setSavedRect(final);
			saveRect(appName, final);
		},
	};

	return {
		rect,
		isMaximized,
		toggleMaximize: () => setIsMaximized((value) => !value),
		/** 제목 표시줄에 붙인다 */
		dragHandlers: {
			onPointerDown: (event: React.PointerEvent) => begin(event, { kind: 'move' }),
			...handlers,
		},
		/** 크기 조절 핸들에 붙인다 */
		resizeHandlers: (direction: ResizeDirection) => ({
			onPointerDown: (event: React.PointerEvent) => begin(event, { kind: 'resize', direction }),
			...handlers,
		}),
	};
}
