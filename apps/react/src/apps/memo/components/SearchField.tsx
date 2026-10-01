import { useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { POST_FILTERS, type PostFilter } from '../posts';

/**
 * 메모 검색 칸 (macOS 메모): 돋보기 옆 ⌄를 누르면 검색 조건(체크리스트가 있는 메모 등)과 '이 메모에서 찾기'.
 * 고른 조건은 검색 칸 안에 작은 표로 붙고, ×나 빈 칸에서 Backspace로 뗀다.
 */
const SearchField = ({
	query,
	onQuery,
	filter,
	onFilter,
	admin,
	onFind,
	onFocusChange,
	className = '',
}: {
	query: string;
	onQuery: (query: string) => void;
	filter: PostFilter | null;
	onFilter: (filter: PostFilter | null) => void;
	/** 관리자면 게시 상태 조건도 보인다 */
	admin: boolean;
	/** 이 메모에서 찾기 (열린 글이 없으면 없다) */
	onFind: (() => void) | null;
	/** 검색 칸에 초점이 들어오고 나갈 때 (도구 막대가 검색 칸을 넓힌다) */
	onFocusChange?: (focused: boolean) => void;
	className?: string;
}) => {
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const current = POST_FILTERS.find((item) => item.id === filter);

	return (
		<div className={`memo-search ${filter ? 'filtered' : ''} ${className}`}>
			<button
				type="button"
				className="memo-search-options"
				aria-label="검색 조건"
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setMenu(menu ? null : { x: rect.left - 6, y: rect.bottom + 8 });
				}}
			>
				<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
				<i className="fa-solid fa-chevron-down" aria-hidden="true" />
			</button>
			{current && (
				<span className="memo-search-chip">
					<i className={current.icon} aria-hidden="true" />
					{current.chip}
					<button type="button" aria-label={`${current.chip} 조건 지우기`} onClick={() => onFilter(null)}>
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				</span>
			)}
			<input
				type="search"
				placeholder="검색"
				aria-label="글 검색"
				value={query}
				onChange={(event) => onQuery(event.target.value)}
				onFocus={() => onFocusChange?.(true)}
				onBlur={() => onFocusChange?.(false)}
				onKeyDown={(event) => {
					if (event.key === 'Backspace' && !query && filter) onFilter(null);
					if (event.key === 'Escape') event.currentTarget.blur();
				}}
			/>
			{menu && (
				<Menu
					label="검색 조건"
					anchor={menu}
					onClose={() => setMenu(null)}
					items={[
						...POST_FILTERS.filter((item) => admin || !item.adminOnly).map((item) => ({
							label: item.label,
							icon: item.icon,
							onSelect: () => onFilter(item.id === filter ? null : item.id),
						})),
						...(onFind
							? [
									'separator' as const,
									{ label: '이 메모에서 찾기…', icon: 'fa-solid fa-magnifying-glass', hint: '⌘F', onSelect: onFind },
								]
							: []),
					]}
				/>
			)}
		</div>
	);
};

export default SearchField;
