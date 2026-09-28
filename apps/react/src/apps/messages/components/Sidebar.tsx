import React, { useState } from 'react';
import Avatar from './Avatar';
import { formatListTime, type Thread } from '../conversations';

interface Props {
	threads: Thread[];
	selectedId: string;
	myThreadId: string | null;
	onSelect: (id: string) => void;
	onCompose: () => void;
}

const Sidebar: React.FC<Props> = ({ threads, selectedId, myThreadId, onSelect, onCompose }) => {
	const [query, setQuery] = useState('');
	const now = new Date();
	const pinned = threads.filter((t) => t.pinned);
	const matches = (thread: Thread) =>
		!query.trim() ||
		`${thread.title} ${thread.lastMessage?.text ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
	const others = threads.filter((t) => !t.pinned && matches(t));

	return (
		<aside className="messages-sidebar" aria-label="대화 목록">
			<div className="messages-sidebar-top">
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
				<button type="button" className="messages-compose" aria-label="새 메시지" title="새 메시지" onClick={onCompose}>
					<i className="fa-regular fa-pen-to-square" aria-hidden="true" />
				</button>
			</div>

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
								<Avatar name={thread.title} size={52} />
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
										{thread.title}
										{thread.id === myThreadId && <span className="messages-me-badge">나</span>}
									</strong>
									{thread.lastMessage && (
										<time dateTime={thread.lastMessage.createdAt}>
											{formatListTime(new Date(thread.lastMessage.createdAt), now)}
										</time>
									)}
								</span>
								<span className="messages-thread-preview">{thread.lastMessage?.text ?? ''}</span>
							</span>
						</button>
					</li>
				))}
				{others.length === 0 && (
					<li className="messages-empty">{query ? '검색 결과가 없습니다.' : '아직 대화가 없어요.'}</li>
				)}
			</ul>
		</aside>
	);
};

export default Sidebar;
