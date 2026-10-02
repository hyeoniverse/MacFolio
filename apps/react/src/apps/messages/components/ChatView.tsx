import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Composer from './Composer';
import Menu from '@/shared/ui/menu/Menu';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { useAdmin } from '@/shared/auth/adminStore';
import { buildTimeline, displayName, type Message, type Thread } from '../conversations';
import type { DeleteResult } from '../repository';
import IconButton from '@/shared/ui/button/IconButton';

interface Props {
	/** null이면 새 피드백을 남기는 화면 */
	thread: Thread | null;
	messages: Message[];
	/** 이 브라우저의 이름 (예: 🦊 날쌘 여우). 이름·비밀번호는 받지 않는다 */
	myName: string | null;
	focusRequest: number;
	/** 좁은 창에서 대화 목록으로 돌아가기 */
	onBack: () => void;
	/** 새 피드백을 그만두기 */
	onCancelNew: () => void;
	onCompose: () => void;
	onSend: (text: string) => Promise<{ text?: string }>;
	onRemove: (messageId: string) => Promise<DeleteResult>;
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

/** 이름 알약 아래 설명. 주인의 안내 글은 설명 없이 이름만 */
const subtitleOf = (thread: Thread) => {
	if (thread.pinned) return null;
	if (thread.mine) return '내가 남긴 피드백';
	return `${thread.title}님의 피드백`;
};

const ChatView: React.FC<Props> = ({
	thread,
	messages,
	myName,
	focusRequest,
	onBack,
	onCancelNew,
	onCompose,
	onSend,
	onRemove,
}) => {
	const [menu, setMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	/** 관리자는 무엇이든, 방문자는 이 브라우저에서 쓴 글만 지운다 (서버가 다시 확인한다) */
	const isAdmin = useAdmin().status === 'signed-in';
	const canDelete = (message: Message) => !message.fromOwner && (message.mine || isAdmin);
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
		if (!canDelete(message)) return;
		event.preventDefault();
		setMenu({ x: event.clientX, y: event.clientY, messageId: message.id });
	};

	return (
		<section
			className="messages-chat"
			aria-label={thread ? (thread.pinned ? `${thread.title}의 안내` : `${thread.title}의 피드백`) : '새 피드백'}
		>
			{/* 창 왼쪽 위에 떠 있는 버튼: 뒤로 가기(좁은 창에서만), 새 피드백 */}
			<div className="messages-chat-toolbar">
				<IconButton
					variant="float"
					className="messages-back"
					label="대화 목록"
					onClick={onBack}
					icon="fa-solid fa-chevron-left"
				/>
				<IconButton variant="float" label="새 피드백" onClick={onCompose} icon="fa-regular fa-pen-to-square" />
			</div>

			{thread ? (
				<header className="messages-chat-header">
					<Avatar name={thread.title} />
					<span className="messages-name-pill">
						{displayName(thread.title, thread.ipPrefix)}
						{thread.mine && <span className="messages-me-badge">나</span>}
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</span>
					{subtitleOf(thread) && <span className="messages-chat-subtitle">{subtitleOf(thread)}</span>}
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
							{canDelete(item.message) && (
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
				onSend={async (text) => {
					const result = await onSend(text);
					return { sent: !result.text, error: result.text };
				}}
			>
				{myName && (
					<p className="messages-as">
						<strong>{myName}</strong> 이름으로 남겨요
					</p>
				)}
			</Composer>

			{menu && (
				<Menu
					label="메시지 메뉴"
					anchor={menu}
					autoFocus
					onClose={() => setMenu(null)}
					items={[{ label: '삭제…', destructive: true, onSelect: () => setDeleting(menu.messageId) }]}
				/>
			)}
			{deleting && (
				<AlertDialog
					title="메시지를 삭제할까요?"
					message="삭제한 메시지는 되돌릴 수 없습니다."
					confirmLabel="삭제"
					onCancel={() => setDeleting(null)}
					onConfirm={() => {
						void onRemove(deleting);
						setDeleting(null);
					}}
				/>
			)}
		</section>
	);
};

export default ChatView;
