import { useId, useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { POST_FILTERS, type PostFilter } from '@macfolio/desktop-core/memo';
import { loadRecentSearches, rememberSearch, saveRecentSearches } from '../memoStorage';
import '@/apps/memo/components/MemoSearch.css';

/**
 * 메모 검색 칸 (macOS 메모): 돋보기 옆 ⌄를 누르면 검색 조건(체크리스트가 있는 메모 등)과 '이 메모에서 찾기'.
 * 고른 조건은 검색 칸 안에 작은 표로 붙고, ×나 빈 칸에서 Backspace로 뗀다.
 * 검색어는 입력을 마친 시각(Enter, 칸에서 나감)에 최근 검색으로 남는다. 빈 칸에 초점이 가면 칸 아래(휴대폰은 위)에
 * 최근 검색 목록이 펼쳐지고(↑↓·Enter로도 고른다), ⌄ 메뉴에도 같은 목록이 있다.
 */
const MemoSearch = ({
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
	// 메뉴를 열 때마다 읽는다 (넓은 창·좁은 창·휴대폰의 검색 칸이 같은 목록을 쓴다)
	const recent = menu ? loadRecentSearches() : [];
	// 빈 칸에 초점이 있는 동안 펼치는 최근 검색 목록 (초점이 들어온 시각에 읽는다)
	const [suggestions, setSuggestions] = useState<string[] | null>(null);
	const [active, setActive] = useState(-1);
	const listId = useId();
	const showRecent = suggestions !== null && suggestions.length > 0 && !query && !menu;
	const pickRecent = (word: string) => {
		onQuery(word);
		// 검색어가 있는 동안은 숨는다. 칸을 다시 비우면 고친 순서로 다시 보인다
		setSuggestions(rememberSearch(word));
		setActive(-1);
	};

	return (
		<div className={`memo-search ${filter ? 'filtered' : ''} ${className}`}>
			<button
				type="button"
				className="memo-search-options"
				aria-label="검색 조건"
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				// 입력 중에 누르면 초점을 검색 칸에 둔다: 초점이 빠지면 넓어진 칸이 줄면서 버튼이 옮겨 가 누름이 빗나간다
				onMouseDown={(event) => {
					if (document.activeElement === event.currentTarget.parentElement?.querySelector('input'))
						event.preventDefault();
				}}
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
				aria-controls={showRecent ? listId : undefined}
				aria-activedescendant={showRecent && active >= 0 ? `${listId}-${active}` : undefined}
				onChange={(event) => {
					onQuery(event.target.value);
					setActive(-1);
				}}
				onFocus={() => {
					setSuggestions(loadRecentSearches());
					setActive(-1);
					onFocusChange?.(true);
				}}
				onBlur={() => {
					rememberSearch(query);
					setSuggestions(null);
					onFocusChange?.(false);
				}}
				onKeyDown={(event) => {
					if (showRecent && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
						event.preventDefault();
						const step = event.key === 'ArrowDown' ? 1 : -1;
						// -1(입력 칸)부터 마지막 검색어까지 돌아간다
						const slots = suggestions.length + 1;
						setActive((index) => ((index + 1 + step + slots) % slots) - 1);
						return;
					}
					if (event.key === 'Enter' && showRecent && active >= 0) {
						event.preventDefault();
						pickRecent(suggestions[active]);
						return;
					}
					if (event.key === 'Enter' && !event.nativeEvent.isComposing) rememberSearch(query);
					if (event.key === 'Backspace' && !query && filter) onFilter(null);
					if (event.key === 'Escape') event.currentTarget.blur();
				}}
			/>
			{showRecent && (
				<div className="memo-search-recent">
					<div className="memo-search-recent-head">
						<span>최근 검색</span>
						<button
							type="button"
							// 초점을 검색 칸에 둔다 (빠지면 목록이 닫힌다)
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								saveRecentSearches([]);
								setSuggestions([]);
							}}
						>
							지우기
						</button>
					</div>
					<ul id={listId} role="listbox" aria-label="최근 검색">
						{suggestions.map((word, index) => (
							<li
								key={word}
								id={`${listId}-${index}`}
								role="option"
								aria-selected={index === active}
								className={index === active ? 'active' : undefined}
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setActive(index)}
								onClick={() => pickRecent(word)}
							>
								<i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
								<span>{word}</span>
							</li>
						))}
					</ul>
				</div>
			)}
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
						'separator',
						{ heading: '최근 검색' },
						...(recent.length
							? recent.map((word) => ({
									label: word,
									onSelect: () => {
										onQuery(word);
										rememberSearch(word);
									},
								}))
							: [{ label: '없음', disabled: true, onSelect: () => undefined }]),
						{
							label: '최근 검색 지우기',
							disabled: recent.length === 0,
							onSelect: () => saveRecentSearches([]),
						},
					]}
				/>
			)}
		</div>
	);
};

export default MemoSearch;
