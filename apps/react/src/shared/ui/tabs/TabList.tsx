import { useRef, type KeyboardEvent } from 'react';

export interface TabItem<T extends string> {
	id: T;
	label: string;
}

export interface TabListProps<T extends string> {
	/** 탭 묶음 이름 (스크린 리더) */
	label: string;
	items: readonly TabItem<T>[];
	value: T;
	onChange: (id: T) => void;
	/** 묶음에 붙일 이름 (모양은 쓰는 쪽의 CSS. 고른 탭은 [aria-selected='true']로 칠한다) */
	className?: string;
}

/**
 * 탭 목록 (WAI-ARIA tabs): 고른 탭에만 Tab으로 들어오고, ←·→로 옮기며 고르고, Home·End로 처음·끝.
 * 탭 패널은 쓰는 쪽이 그린다. 모양은 앱마다 다르므로 className으로 정한다
 */
const TabList = <T extends string>({ label, items, value, onChange, className }: TabListProps<T>) => {
	const list = useRef<HTMLDivElement>(null);

	const onKeyDown = (event: KeyboardEvent) => {
		const index = items.findIndex((item) => item.id === value);
		const next = {
			ArrowRight: (index + 1) % items.length,
			ArrowLeft: (index - 1 + items.length) % items.length,
			Home: 0,
			End: items.length - 1,
		}[event.key];
		if (next === undefined || next === index) return;
		event.preventDefault();
		onChange(items[next].id);
		list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
	};

	return (
		<div ref={list} className={className} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
			{items.map(({ id, label: name }) => (
				<button
					key={id}
					type="button"
					role="tab"
					aria-selected={id === value}
					tabIndex={id === value ? 0 : -1}
					onClick={() => onChange(id)}
				>
					{name}
				</button>
			))}
		</div>
	);
};

export default TabList;
