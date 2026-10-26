import React, { useCallback, useEffect, useRef, useState } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import Menu from '@/shared/ui/menu/Menu';
import type { NavStep } from '../useMemoNavHistory';

/** 길게 누르는 시간: 이보다 오래 누르면 목록을 연다 (macOS 뒤로 버튼과 비슷하게) */
const LONG_PRESS_MS = 500;
/** 누른 채 아래로 이만큼 끌면 바로 목록을 연다 (macOS처럼) */
const DRAG_OPEN_PX = 8;

/**
 * ‹ 또는 › 버튼 하나. 누르면 한 칸, 길게 누르거나 누른 채 아래로 끌거나 오른쪽 클릭하면 그 방향의 기록 목록을 연다.
 * 목록이 열린 뒤 손을 떼도 한 칸 이동은 하지 않는다
 */
const StepButton: React.FC<{
	label: string;
	icon: string;
	disabled: boolean;
	onStep: () => void;
	steps: () => NavStep[];
	onGo: (index: number) => void;
}> = ({ label, icon, disabled, onStep, steps, onGo }) => {
	const [menu, setMenu] = useState<{ anchor: { x: number; y: number }; items: NavStep[] } | null>(null);
	const button = useRef<HTMLButtonElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pressedAt = useRef<number | null>(null);
	/** 이번 누르기로 목록을 열었는지 (손을 뗄 때 오는 click을 한 칸 이동으로 보지 않는다) */
	const opened = useRef(false);

	const stopTimer = () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
	};
	useEffect(() => stopTimer, []);
	const close = useCallback(() => setMenu(null), []);
	const openList = () => {
		stopTimer();
		pressedAt.current = null;
		const rect = button.current?.getBoundingClientRect();
		if (!rect) return;
		opened.current = true;
		setMenu({ anchor: { x: rect.left, y: rect.bottom + 6 }, items: steps() });
	};

	return (
		<>
			<IconButton
				ref={button}
				className="memo-history-step"
				label={label}
				title={`${label} (길게 누르면 목록)`}
				icon={icon}
				disabled={disabled}
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				onPointerDown={(event) => {
					// 메뉴가 열려 있을 때 이 버튼을 누르면, 바깥 누르기로 닫힌 뒤 다시 열리지 않게 한다
					event.stopPropagation();
					if (event.button !== 0) return;
					opened.current = false;
					pressedAt.current = event.clientY;
					timer.current = setTimeout(openList, LONG_PRESS_MS);
				}}
				onPointerMove={(event) => {
					if (pressedAt.current !== null && event.clientY - pressedAt.current > DRAG_OPEN_PX) openList();
				}}
				onPointerUp={() => {
					stopTimer();
					pressedAt.current = null;
				}}
				onPointerCancel={() => {
					stopTimer();
					pressedAt.current = null;
				}}
				onContextMenu={(event) => {
					event.preventDefault();
					openList();
				}}
				onClick={() => {
					if (opened.current) {
						opened.current = false;
						return;
					}
					if (menu) return close();
					onStep();
				}}
			/>
			{menu && (
				<Menu
					label={`${label} 기록`}
					className="memo-history-menu"
					anchor={menu.anchor}
					onClose={close}
					trigger={button}
					items={menu.items.map((step) => ({
						label: step.label,
						detail: step.detail || undefined,
						icon: step.post ? 'fa-regular fa-note-sticky' : 'fa-regular fa-folder',
						onSelect: () => onGo(step.index),
					}))}
				/>
			)}
		</>
	);
};

/** 메모의 뒤로·앞으로 버튼 한 쌍 (도구 막대, Finder·Safari처럼) */
const HistoryNav: React.FC<{
	canBack: boolean;
	canForward: boolean;
	onBack: () => void;
	onForward: () => void;
	backSteps: () => NavStep[];
	forwardSteps: () => NavStep[];
	onGo: (index: number) => void;
}> = ({ canBack, canForward, onBack, onForward, backSteps, forwardSteps, onGo }) => (
	<div className="memo-history" role="group" aria-label="이동 기록">
		<StepButton
			label="뒤로"
			icon="fa-solid fa-chevron-left"
			disabled={!canBack}
			onStep={onBack}
			steps={backSteps}
			onGo={onGo}
		/>
		<StepButton
			label="앞으로"
			icon="fa-solid fa-chevron-right"
			disabled={!canForward}
			onStep={onForward}
			steps={forwardSteps}
			onGo={onGo}
		/>
	</div>
);

export default HistoryNav;
