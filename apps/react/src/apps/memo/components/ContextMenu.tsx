import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type MenuItem =
	{ label: string; icon: string; onSelect: () => void; disabled?: boolean; hint?: string } | 'separator';

/**
 * macOS 메뉴 (••• 단추, 우클릭). 창·사이드바에 잘리지 않게 body에 그리고, 연 자리(anchor)에 놓는다.
 * 바깥을 누르거나 Esc를 누르면 닫힌다.
 */
const ContextMenu: React.FC<{
	label: string;
	anchor: { x: number; y: number };
	items: MenuItem[];
	onClose: () => void;
}> = ({ label, anchor, items, onClose }) => {
	const ref = useRef<HTMLDivElement>(null);

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
			style={{ left: anchor.x, top: anchor.y }}
		>
			{items.map((item, index) =>
				item === 'separator' ? (
					<hr key={`separator-${index}`} />
				) : (
					<button
						key={item.label}
						type="button"
						role="menuitem"
						disabled={item.disabled}
						title={item.hint}
						onClick={() => {
							onClose();
							item.onSelect();
						}}
					>
						<i className={item.icon} aria-hidden="true" />
						{item.label}
					</button>
				)
			)}
		</div>,
		document.body
	);
};

export default ContextMenu;
