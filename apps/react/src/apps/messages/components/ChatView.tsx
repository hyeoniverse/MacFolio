import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Composer from './Composer';
import ContextMenu from './ContextMenu';
import DeleteDialog from './DeleteDialog';
import { buildTimeline, displayName, LIMITS, type InputErrors, type Message, type Thread } from '../conversations';
import type { DeleteResult } from '../repository';

interface Props {
	/** null이면 새 피드백을 남기는 화면 */
	thread: Thread | null;
	messages: Message[];
	identity: {
		nickname: string;
		password: string;
		setNickname: (value: string) => void;
		setPassword: (value: string) => void;
	};
	focusRequest: number;
	/** 좁은 창에서 대화 목록으로 돌아가기 */
	onBack: () => void;
	/** 새 피드백을 그만두기 */
	onCancelNew: () => void;
	onCompose: () => void;
	onSend: (text: string) => Promise<InputErrors>;
	onRemove: (messageId: string, password: string) => Promise<DeleteResult>;
}

/** "오늘 오전 10:36"에서 날짜 부분만 굵게 (메시지 앱과 같은 모양) */
const TimeLabel: React.FC<{ label: string }> = ({ label }) => {
	const words = label.split(' ');
	return (
		<>
			<strong>{words.slice(0, -2).join(' ')}</strong> {words.slice(-2).join(' ')}
		</>
	);
};

const subtitleOf = (thread: Thread) => {
	if (thread.pinned) return '안내 · 누구나 답글을 달 수 있어요';
	if (thread.mine) return '내가 남긴 피드백';
	return `${thread.title}님의 피드백`;
};

const ChatView: React.FC<Props> = ({
	thread,
	messages,
	identity,
	focusRequest,
	onBack,
	onCancelNew,
	onCompose,
	onSend,
	onRemove,
}) => {
	const [menu, setMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [errors, setErrors] = useState<InputErrors>({});
	const listEnd = useRef<HTMLDivElement>(null);
	const timeline = buildTimeline(messages, { now: new Date() });

	// 항목을 열거나 새 글이 생기면 맨 아래로
	useEffect(() => {
		listEnd.current?.scrollIntoView({ block: 'end' });
	}, [thread?.id, messages.length]);

	// 새 피드백 화면은 Esc로 그만둔다 (팝업이 열려 있으면 팝업이 먼저 닫힌다)
	useEffect(() => {
		if (thread) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) onCancelNew();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [thread, onCancelNew]);

	const openMenu = (event: React.MouseEvent, message: Message) => {
		if (message.fromOwner) return;
		event.preventDefault();
		const box = (event.currentTarget.closest('.messages-chat') as HTMLElement).getBoundingClientRect();
		setMenu({ x: event.clientX - box.left, y: event.clientY - box.top, messageId: message.id });
	};

	return (
		<section
			className="messages-chat"
			aria-label={thread ? (thread.pinned ? `${thread.title}의 안내` : `${thread.title}의 피드백`) : '새 피드백'}
		>
			{/* 창 왼쪽 위에 떠 있는 버튼: 뒤로 가기(좁은 창에서만), 새 피드백 */}
			<div className="messages-chat-toolbar">
				<button type="button" className="messages-round-button messages-back" aria-label="대화 목록" onClick={onBack}>
					<i className="fa-solid fa-chevron-left" aria-hidden="true" />
				</button>
				<button
					type="button"
					className="messages-round-button"
					aria-label="새 피드백"
					title="새 피드백"
					onClick={onCompose}
				>
					<i className="fa-regular fa-pen-to-square" aria-hidden="true" />
				</button>
			</div>

			{thread ? (
				<header className="messages-chat-header">
					<Avatar name={thread.title} />
					<span className="messages-name-pill">
						{displayName(thread.title, thread.ipPrefix)}
						{thread.mine && <span className="messages-me-badge">나</span>}
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</span>
					<span className="messages-chat-subtitle">{subtitleOf(thread)}</span>
				</header>
			) : (
				<header className="messages-chat-header">
					<span className="messages-name-pill">새 피드백</span>
					<span className="messages-chat-subtitle">감상, 의견, 피드백을 남겨 주세요. 보내면 목록에 올라가요</span>
					<button type="button" className="messages-cancel" onClick={onCancelNew}>
						취소
					</button>
				</header>
			)}

			<div className="messages-transcript" role="log" aria-live="polite">
				{timeline.map((item) =>
					item.type === 'time' ? (
						<p key={item.key} className="messages-time">
							<time dateTime={item.dateTime}>
								<TimeLabel label={item.label} />
							</time>
						</p>
					) : (
						<div
							key={item.key}
							className={`messages-bubble-row ${item.side} ${item.tail ? 'tail' : ''}`}
							onContextMenu={(event) => openMenu(event, item.message)}
						>
							{item.showName && (
								<span className="messages-sender">{displayName(item.message.nickname, item.message.ipPrefix)}</span>
							)}
							<p className="messages-bubble">{item.message.text}</p>
							{!item.message.fromOwner && (
								<button
									type="button"
									className="messages-bubble-action"
									aria-label="메시지 삭제"
									onClick={() => setDeleting(item.message.id)}
								>
									<i className="fa-solid fa-trash-can" aria-hidden="true" />
								</button>
							)}
							{item.receipt && <span className="messages-receipt">전송됨</span>}
						</div>
					)
				)}
				<div ref={listEnd} />
			</div>

			<Composer
				key={focusRequest}
				placeholder={thread ? '답글' : '감상, 의견, 피드백'}
				autoFocus={focusRequest > 0}
				error={errors.nickname ?? errors.password}
				onSend={async (text) => {
					const result = await onSend(text);
					setErrors(result);
					// 이름·비밀번호 오류는 위에서 보여주고, 입력한 메시지는 지우지 않는다
					return { sent: Object.keys(result).length === 0, error: result.text };
				}}
			>
				<div className="messages-identity">
					<input
						aria-label="이름"
						placeholder="이름"
						maxLength={LIMITS.nickname.max}
						value={identity.nickname}
						aria-invalid={!!errors.nickname}
						onChange={(event) => identity.setNickname(event.target.value)}
					/>
					<input
						type="password"
						aria-label="비밀번호"
						placeholder="비밀번호 (삭제할 때 필요)"
						maxLength={LIMITS.password.max}
						value={identity.password}
						aria-invalid={!!errors.password}
						onChange={(event) => identity.setPassword(event.target.value)}
					/>
				</div>
			</Composer>

			{menu && (
				<ContextMenu
					x={menu.x}
					y={menu.y}
					onClose={() => setMenu(null)}
					items={[{ label: '삭제…', destructive: true, onSelect: () => setDeleting(menu.messageId) }]}
				/>
			)}
			{deleting && (
				<DeleteDialog onClose={() => setDeleting(null)} onDelete={(password) => onRemove(deleting, password)} />
			)}
		</section>
	);
};

export default ChatView;
