import React, { useRef } from 'react';
import { clampSidebarWidth, SIDEBAR_WIDTH } from '../memoStorage';

interface Props {
	width: number;
	/** 끄는 동안 계속 부른다 (화면만 바꾼다) */
	onResize: (width: number) => void;
	/** 다 끌었거나 키보드로 바꿨을 때 (저장한다) */
	onCommit: (width: number) => void;
	/** 끄는 중인지 (끄는 동안은 칸 너비 애니메이션을 끈다) */
	onDraggingChange: (dragging: boolean) => void;
}

/** 키보드로 한 번에 바꾸는 양(px). Shift를 누르면 크게 */
const STEP = 8;
const BIG_STEP = 32;

/**
 * 사이드바 오른쪽 경계의 너비 조절 손잡이. macOS 메모처럼 경계를 끌어 사이드바를 넓히거나 좁힌다.
 * 키보드: ←·→(Shift면 크게), Home·End는 가장 좁게·넓게. 두 번 누르면 기본 너비로 돌아간다.
 * 사이드바가 닫혀 있거나 한 칸씩 볼 때는 Memo.css가 숨긴다
 */
const SidebarResizer: React.FC<Props> = ({ width, onResize, onCommit, onDraggingChange }) => {
	const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null);

	const set = (next: number) => {
		const clamped = clampSidebarWidth(next);
		onResize(clamped);
		onCommit(clamped);
	};

	return (
		<div
			className="memo-sidebar-resizer"
			role="separator"
			aria-orientation="vertical"
			aria-label="사이드바 너비"
			aria-valuemin={SIDEBAR_WIDTH.min}
			aria-valuemax={SIDEBAR_WIDTH.max}
			aria-valuenow={width}
			tabIndex={0}
			title="끌어서 사이드바 너비 조절 (두 번 누르면 기본 너비)"
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				drag.current = { startX: event.clientX, startWidth: width, width };
				onDraggingChange(true);
			}}
			onPointerMove={(event) => {
				const state = drag.current;
				if (!state) return;
				state.width = clampSidebarWidth(state.startWidth + event.clientX - state.startX);
				onResize(state.width);
			}}
			onPointerUp={() => {
				const state = drag.current;
				if (!state) return;
				drag.current = null;
				onDraggingChange(false);
				onCommit(state.width);
			}}
			onPointerCancel={() => {
				const state = drag.current;
				if (!state) return;
				drag.current = null;
				onDraggingChange(false);
				onResize(state.startWidth);
			}}
			onDoubleClick={() => set(SIDEBAR_WIDTH.initial)}
			onKeyDown={(event) => {
				const step = event.shiftKey ? BIG_STEP : STEP;
				const next =
					event.key === 'ArrowLeft'
						? width - step
						: event.key === 'ArrowRight'
							? width + step
							: event.key === 'Home'
								? SIDEBAR_WIDTH.min
								: event.key === 'End'
									? SIDEBAR_WIDTH.max
									: null;
				if (next === null) return;
				event.preventDefault();
				set(next);
			}}
		/>
	);
};

export default SidebarResizer;
