import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { placeAtPoint } from '@/shared/ui/popover/placement';
import { useDismiss } from '@/shared/ui/popover/useDismiss';
import '@/shared/ui/menu/Menu.css';

export type MenuItem =
	| {
			label: string;
			/** 아이콘: Font Awesome 클래스나 그린 아이콘(SVG). checked가 있으면 대신 체크 표시 자리를 쓴다 */
			icon?: string | React.ReactElement;
			onSelect: () => void;
			disabled?: boolean;
			/** 마우스를 올리면 보이는 설명 (title) */
			hint?: string;
			/** 고를 수 있는 항목 (정렬 기준 등). true면 앞에 체크 표시 */
			checked?: boolean;
			/** 지우기처럼 되돌릴 수 없는 일 */
			destructive?: boolean;
	  }
	/** 묶음 이름 (눌리지 않는다) */
	| { heading: string }
	/** 안내 한 줄 (예: "○○(으)로 로그인됨") */
	| { note: string }
	/** 아이콘 위·글자 아래 단추를 가로로 늘어놓은 한 줄 (iOS 메뉴 맨 위의 고정·잠그기처럼) */
	| { row: { label: string; icon: string; onSelect: () => void; disabled?: boolean }[] }
	| 'separator';

interface Props {
	/** 메뉴 이름 (스크린 리더) */
	label: string;
	/** 연 자리 (화면 기준, 마우스 이벤트의 clientX·clientY 그대로). 넘치면 안쪽으로 당긴다 */
	anchor: { x: number; y: number };
	items: MenuItem[];
	onClose: () => void;
	/** 눌러도 닫지 않을 요소 (메뉴를 여는 단추: 다시 누르면 단추가 닫는다) */
	trigger?: React.RefObject<Element | null>;
	/** 열자마자 첫 항목에 초점 (키보드로 바로 고르게). 검색 칸처럼 초점을 지켜야 하는 곳에서 열면 끈다 */
	autoFocus?: boolean;
	/** 모양을 덧붙일 이름 (예: 휴대폰에서 iOS처럼 크게) */
	className?: string;
}

const isAction = (item: MenuItem): item is Extract<MenuItem, { onSelect: () => void }> =>
	typeof item === 'object' && 'onSelect' in item;

/**
 * macOS 메뉴 (우클릭, ••• 단추, Apple 메뉴). 창에 잘리지 않게 body에 그리고, 연 자리에 둔다.
 * 바깥을 누르거나 Esc를 누르면 닫히고, ↑·↓·Home·End로 항목을 옮겨 다닌다.
 */
const Menu: React.FC<Props> = ({ label, anchor, items, onClose, trigger, autoFocus = false, className }) => {
	const ref = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: anchor.x, top: anchor.y });
	useDismiss(true, onClose, trigger ? [ref, trigger] : [ref]);

	// 그려진 크기를 재서 화면 밖으로 넘치지 않게 한다 (그리기 전에 옮겨 깜빡이지 않는다)
	useLayoutEffect(() => {
		const menu = ref.current;
		if (!menu) return;
		const { width, height } = menu.getBoundingClientRect();
		setPosition(placeAtPoint({ left: anchor.x, top: anchor.y }, { width, height }));
		if (autoFocus) menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
	}, [anchor.x, anchor.y, autoFocus]);

	const moveFocus = (event: React.KeyboardEvent) => {
		const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
		if (!buttons.length) return;
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'ArrowDown'
				? buttons[(at + 1) % buttons.length]
				: event.key === 'ArrowUp'
					? buttons[(at - 1 + buttons.length) % buttons.length]
					: event.key === 'Home'
						? buttons[0]
						: event.key === 'End'
							? buttons[buttons.length - 1]
							: null;
		if (!next) return;
		event.preventDefault();
		next.focus();
	};

	// 아이콘이나 체크가 있는 항목이 하나라도 있으면 모든 항목에 아이콘 자리를 두어 글자를 맞춘다
	const iconColumn = items.some((item) => isAction(item) && (item.icon !== undefined || item.checked !== undefined));

	return createPortal(
		<div
			ref={ref}
			className={['ui-menu', className].filter(Boolean).join(' ')}
			role="menu"
			aria-label={label}
			style={{ left: position.left, top: position.top }}
			onKeyDown={moveFocus}
		>
			{items.map((item, index) => {
				if (item === 'separator') return <hr key={`separator-${index}`} className="ui-menu-separator" />;
				if ('heading' in item)
					return (
						<p key={`heading-${item.heading}`} className="ui-menu-heading" role="presentation">
							{item.heading}
						</p>
					);
				if ('row' in item)
					return (
						<div key={`row-${index}`} className="ui-menu-row" role="group">
							{item.row.map((action) => (
								<button
									key={action.label}
									type="button"
									className="ui-menu-row-item"
									role="menuitem"
									disabled={action.disabled}
									onClick={() => {
										onClose();
										action.onSelect();
									}}
								>
									<i className={action.icon} aria-hidden="true" />
									{action.label}
								</button>
							))}
						</div>
					);
				if ('note' in item)
					return (
						<p key={`note-${index}`} className="ui-menu-note" role="presentation">
							{item.note}
						</p>
					);
				const checkable = item.checked !== undefined;
				return (
					<button
						key={item.label}
						type="button"
						className={`ui-menu-item ${item.destructive ? 'destructive' : ''}`}
						role={checkable ? 'menuitemcheckbox' : 'menuitem'}
						aria-checked={checkable ? item.checked : undefined}
						disabled={item.disabled}
						title={item.hint}
						onClick={() => {
							onClose();
							item.onSelect();
						}}
					>
						{iconColumn &&
							(!checkable && item.icon && typeof item.icon !== 'string' ? (
								<i aria-hidden="true">{item.icon}</i>
							) : (
								<i
									className={checkable ? (item.checked ? 'fa-solid fa-check' : '') : (item.icon as string | undefined)}
									aria-hidden="true"
								/>
							))}
						{item.label}
					</button>
				);
			})}
		</div>,
		document.body
	);
};

export default Menu;
