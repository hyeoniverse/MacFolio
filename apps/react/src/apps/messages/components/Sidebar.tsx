import React, { useState } from 'react';
import Avatar from './Avatar';
import { displayName, formatListTime, type Thread } from '../conversations';
import IconButton from '@/shared/ui/button/IconButton';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import SearchField from '@/shared/ui/search-field/SearchField';
import SidebarPanel from '@/shared/ui/sidebar/Sidebar';
import ListRow from '@/shared/ui/list-row/ListRow';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

interface Props {
	threads: Thread[];
	selectedId: string;
	onSelect: (id: string) => void;
	onCompose: () => void;
	/** 목록을 불러오는 중. 빈 목록 안내를 아직 보이지 않는다 */
	loading?: boolean;
}

const Sidebar: React.FC<Props> = ({ threads, selectedId, onSelect, onCompose, loading = false }) => {
	const [query, setQuery] = useState('');
	/** 휴대폰 검색 알약에 들어가 있는 동안. 이때 오른쪽 버튼은 새 피드백 대신 검색 끝내기(×) */
	const [focused, setFocused] = useState(false);
	const searching = focused || query !== '';
	/** 휴대폰은 iOS 메시지 크기의 아바타 */
	const phone = useIsMobile();
	const now = new Date();
	const pinned = threads.filter((t) => t.pinned);
	const matches = (thread: Thread) =>
		!query.trim() || `${thread.title} ${thread.summary ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
	const others = threads.filter((t) => !t.pinned && matches(t));

	const searchField = (className: string) => (
		<SearchField
			className={className}
			label="대화 검색"
			placeholder="검색"
			value={query}
			onChange={(event) => setQuery(event.target.value)}
		/>
	);

	return (
		<>
			<SidebarPanel variant="floating" as="aside" className="messages-sidebar" aria-label="대화 목록">
				{/* 신호등 버튼 자리. 좁은 창에서는 새 피드백 버튼이 여기로 온다 */}
				<div className="messages-sidebar-top">
					<IconButton
						variant="float"
						className="messages-compose-compact"
						label="새 피드백"
						onClick={onCompose}
						icon="fa-regular fa-pen-to-square"
					/>
				</div>

				{/* 휴대폰: iOS 메시지처럼 떠 있는 뒤로 가기와 같은 줄 가운데에 제목 */}
				<h2 className="messages-phone-title phone-title">메시지</h2>

				{searchField('messages-search')}

				{pinned.length > 0 && !query && (
					<ul className="messages-pinned">
						{pinned.map((thread) => (
							<ListRow
								key={thread.id}
								className={`messages-pinned-item ${selectedId === thread.id ? 'selected' : ''}`}
								current={selectedId === thread.id}
								onClick={() => onSelect(thread.id)}
							>
								<Avatar name={thread.title} size={phone ? 128 : 66} />
								<span>{thread.title}</span>
							</ListRow>
						))}
					</ul>
				)}

				<ul className="messages-threads">
					{others.map((thread) => (
						<ListRow
							key={thread.id}
							className={`messages-thread ${selectedId === thread.id ? 'selected' : ''}`}
							current={selectedId === thread.id}
							onClick={() => onSelect(thread.id)}
						>
							<Avatar name={thread.title} size={phone ? 62 : 40} />
							<span className="messages-thread-text">
								<span className="messages-thread-top">
									<strong>
										{displayName(thread.title, thread.ipPrefix)}
										{thread.mine && <span className="messages-me-badge">나</span>}
									</strong>
									{thread.lastMessage && (
										<time dateTime={thread.lastMessage.createdAt}>
											{formatListTime(new Date(thread.lastMessage.createdAt), now)}
											<i className="fa-solid fa-chevron-right messages-thread-chevron" aria-hidden="true" />
										</time>
									)}
								</span>
								<span className="messages-thread-preview">{thread.summary ?? ''}</span>
							</span>
						</ListRow>
					))}
					{others.length === 0 && !loading && (
						<EmptyState as="li" className="messages-empty">
							<i
								className={`messages-empty-icon ${query ? 'fa-solid fa-magnifying-glass' : 'fa-regular fa-comments'}`}
								aria-hidden="true"
							/>
							<strong>{query ? '검색 결과가 없습니다.' : '아직 남겨진 피드백이 없어요.'}</strong>
							<span className="messages-empty-hint">
								{query ? '맞춤법을 확인하거나 새로운 검색을 시도하십시오.' : '첫 번째 피드백을 남겨 주세요.'}
							</span>
						</EmptyState>
					)}
				</ul>
			</SidebarPanel>
			{/* 휴대폰: 아래에 떠 있는 검색 알약과 새 피드백 (넘기는 목록 밖에 둔다) */}
			<div
				className="messages-phone-bottom"
				onFocus={(event) => setFocused(event.target instanceof HTMLInputElement)}
				onBlur={() => setFocused(false)}
			>
				{searchField('messages-search messages-phone-search')}
				{searching ? (
					<IconButton
						variant="float"
						className="phone-float"
						label="검색 닫기"
						icon="fa-solid fa-xmark"
						// 누르는 순간 입력 칸이 포커스를 잃어 버튼이 바뀌지 않도록
						onPointerDown={(event) => event.preventDefault()}
						onClick={() => {
							setQuery('');
							setFocused(false);
							(document.activeElement as HTMLElement | null)?.blur();
						}}
					/>
				) : (
					<IconButton
						variant="float"
						className="phone-float"
						label="새 피드백"
						icon="fa-regular fa-pen-to-square"
						onClick={onCompose}
					/>
				)}
			</div>
		</>
	);
};

export default Sidebar;
