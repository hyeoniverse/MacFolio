import React, { useState } from 'react';
import Avatar from './Avatar';
import { displayName, formatListTime, type Thread } from '../conversations';
import IconButton from '@/shared/ui/button/IconButton';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

interface Props {
	threads: Thread[];
	selectedId: string;
	onSelect: (id: string) => void;
	onCompose: () => void;
}

const Sidebar: React.FC<Props> = ({ threads, selectedId, onSelect, onCompose }) => {
	const [query, setQuery] = useState('');
	/** 휴대폰은 iOS 메시지 크기의 아바타 */
	const phone = useIsMobile();
	const now = new Date();
	const pinned = threads.filter((t) => t.pinned);
	const matches = (thread: Thread) =>
		!query.trim() || `${thread.title} ${thread.summary ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
	const others = threads.filter((t) => !t.pinned && matches(t));

	const searchField = (className: string) => (
		<label className={className}>
			<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
			<input
				type="search"
				placeholder="검색"
				aria-label="대화 검색"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
		</label>
	);

	return (
		<>
			<aside className="messages-sidebar" aria-label="대화 목록">
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

				{/* 휴대폰: iOS 메시지처럼 큰 제목 */}
				<h2 className="messages-phone-title phone-title">메시지</h2>

				{searchField('messages-search')}

				{pinned.length > 0 && !query && (
					<ul className="messages-pinned">
						{pinned.map((thread) => (
							<li key={thread.id}>
								<button
									type="button"
									className={`messages-pinned-item ${selectedId === thread.id ? 'selected' : ''}`}
									aria-current={selectedId === thread.id || undefined}
									onClick={() => onSelect(thread.id)}
								>
									<Avatar name={thread.title} size={phone ? 76 : 66} />
									<span>{thread.title}</span>
								</button>
							</li>
						))}
					</ul>
				)}

				<ul className="messages-threads">
					{others.map((thread) => (
						<li key={thread.id}>
							<button
								type="button"
								className={`messages-thread ${selectedId === thread.id ? 'selected' : ''}`}
								aria-current={selectedId === thread.id || undefined}
								onClick={() => onSelect(thread.id)}
							>
								<Avatar name={thread.title} size={phone ? 52 : 40} />
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
							</button>
						</li>
					))}
					{others.length === 0 && (
						<li className="messages-empty">
							<i
								className={`messages-empty-icon fa-regular ${query ? 'fa-face-meh' : 'fa-comments'}`}
								aria-hidden="true"
							/>
							<strong>{query ? '검색 결과가 없습니다.' : '아직 남겨진 피드백이 없어요.'}</strong>
							{!query && <span className="messages-empty-hint">아래의 쓰기 단추로 첫 피드백을 남겨 보세요.</span>}
						</li>
					)}
				</ul>
			</aside>
			{/* 휴대폰: 아래에 떠 있는 검색 알약과 새 피드백 (넘기는 목록 밖에 둔다) */}
			<div className="messages-phone-bottom">
				{searchField('messages-search messages-phone-search')}
				<button type="button" className="phone-float" aria-label="새 피드백" onClick={onCompose}>
					<i className="fa-regular fa-pen-to-square" aria-hidden="true" />
				</button>
			</div>
		</>
	);
};

export default Sidebar;
