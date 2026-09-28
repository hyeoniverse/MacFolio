import React, { useState } from 'react';
import Avatar from './Avatar';
import { displayName, formatListTime, type Thread } from '../conversations';

interface Props {
	threads: Thread[];
	selectedId: string;
	onSelect: (id: string) => void;
	onCompose: () => void;
}

const Sidebar: React.FC<Props> = ({ threads, selectedId, onSelect, onCompose }) => {
	const [query, setQuery] = useState('');
	const now = new Date();
	const pinned = threads.filter((t) => t.pinned);
	const matches = (thread: Thread) =>
		!query.trim() || `${thread.title} ${thread.summary ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
	const others = threads.filter((t) => !t.pinned && matches(t));

	return (
		<aside className="messages-sidebar" aria-label="대화 목록">
			{/* 신호등 버튼 자리. 좁은 창에서는 새 피드백 버튼이 여기로 온다 */}
			<div className="messages-sidebar-top">
				<button
					type="button"
					className="messages-round-button messages-compose-compact"
					aria-label="새 피드백"
					title="새 피드백"
					onClick={onCompose}
				>
					<i className="fa-regular fa-pen-to-square" aria-hidden="true" />
				</button>
			</div>

			<label className="messages-search">
				<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
				<input
					type="search"
					placeholder="검색"
					aria-label="대화 검색"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</label>

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
								<Avatar name={thread.title} size={66} />
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
							<Avatar name={thread.title} />
							<span className="messages-thread-text">
								<span className="messages-thread-top">
									<strong>
										{displayName(thread.title, thread.ipPrefix)}
										{thread.mine && <span className="messages-me-badge">나</span>}
									</strong>
									{thread.lastMessage && (
										<time dateTime={thread.lastMessage.createdAt}>
											{formatListTime(new Date(thread.lastMessage.createdAt), now)}
										</time>
									)}
								</span>
								<span className="messages-thread-preview">{thread.summary ?? ''}</span>
							</span>
						</button>
					</li>
				))}
				{others.length === 0 && (
					<li className="messages-empty">{query ? '검색 결과가 없습니다.' : '아직 남겨진 피드백이 없어요.'}</li>
				)}
			</ul>
		</aside>
	);
};

export default Sidebar;
