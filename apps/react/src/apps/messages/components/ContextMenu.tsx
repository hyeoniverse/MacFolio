import React, { useEffect, useRef } from 'react';

interface Props {
	x: number;
	y: number;
	items: { label: string; onSelect: () => void; destructive?: boolean }[];
	onClose: () => void;
}

/** macOS 오른쪽 클릭 메뉴. 바깥을 클릭하거나 Esc를 누르면 닫힌다. */
const ContextMenu: React.FC<Props> = ({ x, y, items, onClose }) => {
	const menu = useRef<HTMLUListElement>(null);

	useEffect(() => {
		menu.current?.querySelector('button')?.focus();
		const close = (event: Event) => {
			if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
			if (event instanceof MouseEvent && menu.current?.contains(event.target as Node)) return;
			onClose();
		};
		window.addEventListener('pointerdown', close);
		window.addEventListener('keydown', close);
		return () => {
			window.removeEventListener('pointerdown', close);
			window.removeEventListener('keydown', close);
		};
	}, [onClose]);

	return (
		<ul ref={menu} className="messages-context-menu" role="menu" style={{ left: x, top: y }}>
			{items.map((item) => (
				<li key={item.label} role="none">
					<button
						type="button"
						role="menuitem"
						className={item.destructive ? 'destructive' : undefined}
						onClick={() => {
							onClose();
							item.onSelect();
						}}
					>
						{item.label}
					</button>
				</li>
			))}
		</ul>
	);
};

export default ContextMenu;
