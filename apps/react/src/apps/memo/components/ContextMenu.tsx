import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MenuItem =
	| {
			label: string;
			/** 아이콘 클래스. checked가 있으면 대신 체크 표시 자리를 쓴다 */
			icon?: string;
			onSelect: () => void;
			disabled?: boolean;
			hint?: string;
			/** 고를 수 있는 항목 (정렬 기준 등). true면 앞에 체크 표시 */
			checked?: boolean;
	  }
	/** 묶음 이름 (눌리지 않는다) */
	| { heading: string }
	| 'separator';

/** 화면 가장자리와 띄울 간격 */
const EDGE = 8;

/**
 * macOS 메뉴 (••• 단추, 우클릭). 창·사이드바에 잘리지 않게 body에 그리고, 연 자리(anchor)에 놓는다.
 * 화면 밖으로 넘치면 안쪽으로 당긴다. 바깥을 누르거나 Esc를 누르면 닫힌다.
 */
const ContextMenu: React.FC<{
	label: string;
	anchor: { x: number; y: number };
	items: MenuItem[];
	onClose: () => void;
}> = ({ label, anchor, items, onClose }) => {
	const ref = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState(anchor);

	// 그려진 크기를 재서 화면 오른쪽·아래로 넘치지 않게 한다 (그리기 전에 옮겨 깜빡이지 않는다)
	useLayoutEffect(() => {
		const menu = ref.current;
		if (!menu) return;
		const { width, height } = menu.getBoundingClientRect();
		setPosition({
			x: Math.max(EDGE, Math.min(anchor.x, window.innerWidth - width - EDGE)),
			y: Math.max(EDGE, Math.min(anchor.y, window.innerHeight - height - EDGE)),
		});
	}, [anchor.x, anchor.y]);

	useEffect(() => {
		const close = (event: Event) => {
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node))
				onClose();
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [onClose]);

	return createPortal(
		<div
			ref={ref}
			className="memo-folder-menu"
			role="menu"
			aria-label={label}
			style={{ left: position.x, top: position.y }}
		>
			{items.map((item, index) => {
				if (item === 'separator') return <hr key={`separator-${index}`} />;
				if ('heading' in item)
					return (
						<p key={`heading-${item.heading}`} className="memo-menu-heading" role="presentation">
							{item.heading}
						</p>
					);
				const checkable = item.checked !== undefined;
				return (
					<button
						key={item.label}
						type="button"
						role={checkable ? 'menuitemcheckbox' : 'menuitem'}
						aria-checked={checkable ? item.checked : undefined}
						disabled={item.disabled}
						title={item.hint}
						onClick={() => {
							onClose();
							item.onSelect();
						}}
					>
						<i className={checkable ? (item.checked ? 'fa-solid fa-check' : '') : item.icon} aria-hidden="true" />
						{item.label}
					</button>
				);
			})}
		</div>,
		document.body
	);
};

export default ContextMenu;
