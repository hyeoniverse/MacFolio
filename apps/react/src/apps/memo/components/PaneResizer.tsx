import React, { useRef } from 'react';
import { clampPaneWidth, PANE_WIDTHS, type ResizablePane } from '../memoStorage';

interface Props {
	pane: ResizablePane;
	/** 화면 읽기 프로그램이 읽는 이름 ('사이드바 너비', '목록 너비') */
	label: string;
	width: number;
	/**
	 * 지금 창에서 넓힐 수 있는 최대 너비 (본문이 너무 좁아지지 않게 Memo.tsx가 계산한다).
	 * 저장된 범위(PANE_WIDTHS)보다 작을 수 있다
	 */
	roomFor: () => number;
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
 * 칸 오른쪽 경계의 너비 조절 손잡이. macOS 메모처럼 경계를 끌어 왼쪽 칸을 넓히거나 좁힌다.
 * 키보드: ←·→(Shift면 크게), Home·End는 가장 좁게·넓게. 두 번 누르면 기본 너비로 돌아간다.
 * 위치는 Memo.css가 칸 너비 변수로 정하고, 칸이 없을 때(사이드바를 가림, 갤러리, 한 칸 보기)는 Memo.tsx가 그리지 않는다
 */
const PaneResizer: React.FC<Props> = ({ pane, label, width, roomFor, onResize, onCommit, onDraggingChange }) => {
	const drag = useRef<{ startX: number; startWidth: number; width: number; max: number } | null>(null);
	const { min, initial } = PANE_WIDTHS[pane];
	const fit = (next: number, max = roomFor()) => Math.min(clampPaneWidth(pane, next), Math.max(min, max));

	const set = (next: number) => {
		const fitted = fit(next);
		onResize(fitted);
		onCommit(fitted);
	};

	return (
		<div
			className={`memo-pane-resizer memo-pane-resizer-${pane}`}
			role="separator"
			aria-orientation="vertical"
			aria-label={label}
			aria-valuemin={min}
			aria-valuemax={PANE_WIDTHS[pane].max}
			aria-valuenow={width}
			tabIndex={0}
			title="끌어서 너비 조절 (두 번 누르면 기본 너비)"
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				drag.current = { startX: event.clientX, startWidth: width, width, max: roomFor() };
				onDraggingChange(true);
			}}
			onPointerMove={(event) => {
				const state = drag.current;
				if (!state) return;
				state.width = fit(state.startWidth + event.clientX - state.startX, state.max);
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
			onDoubleClick={() => set(initial)}
			onKeyDown={(event) => {
				const step = event.shiftKey ? BIG_STEP : STEP;
				const next =
					event.key === 'ArrowLeft'
						? width - step
						: event.key === 'ArrowRight'
							? width + step
							: event.key === 'Home'
								? min
								: event.key === 'End'
									? PANE_WIDTHS[pane].max
									: null;
				if (next === null) return;
				event.preventDefault();
				set(next);
			}}
		/>
	);
};

export default PaneResizer;
