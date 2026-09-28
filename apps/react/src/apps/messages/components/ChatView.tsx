import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Composer from './Composer';
import ContextMenu from './ContextMenu';
import DeleteDialog from './DeleteDialog';
import {
	buildTimeline,
	LIMITS,
	OWNER_NAME,
	type InputErrors,
	type Message,
	type NewThreadInput,
	type Thread,
} from '../conversations';
import type { DeleteResult } from '../repository';

interface Props {
	/** null이면 새 대화 화면 */
	thread: Thread | null;
	messages: Message[];
	isMine: boolean;
	hasMyThread: boolean;
	onOpenMyThread: () => void;
	onStartThread: (input: NewThreadInput) => Promise<InputErrors>;
	onSend: (text: string) => Promise<string | undefined>;
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

const ChatView: React.FC<Props> = ({
	thread,
	messages,
	isMine,
	hasMyThread,
	onOpenMyThread,
	onStartThread,
	onSend,
	onRemove,
}) => {
	const [menu, setMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	const listEnd = useRef<HTMLDivElement>(null);
	const timeline = buildTimeline(messages, { showReceipt: isMine, now: new Date() });

	// 대화를 열거나 새 메시지가 생기면 맨 아래로
	useEffect(() => {
		listEnd.current?.scrollIntoView({ block: 'end' });
	}, [thread?.id, messages.length]);

	const openMenu = (event: React.MouseEvent, message: Message) => {
		if (message.fromOwner) return;
		event.preventDefault();
		const box = (event.currentTarget.closest('.messages-chat') as HTMLElement).getBoundingClientRect();
		setMenu({ x: event.clientX - box.left, y: event.clientY - box.top, messageId: message.id });
	};

	return (
		<section className="messages-chat" aria-label={thread ? `${thread.title}와의 대화` : '새 메시지'}>
			<header className="messages-chat-header">
				{thread ? (
					<>
						<Avatar name={thread.title} size={28} />
						<span>
							{thread.title}
							{isMine && <span className="messages-me-badge">나</span>}
						</span>
					</>
				) : (
					<p className="messages-to">
						<span>받는 사람:</span> {OWNER_NAME}
					</p>
				)}
			</header>

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

			{!thread && <NewThreadComposer onStart={onStartThread} />}
			{thread && isMine && (
				<Composer
					onSend={async (text) => {
						const error = await onSend(text);
						return { sent: !error, error };
					}}
				/>
			)}
			{thread && !isMine && (
				<footer className="messages-readonly">
					<p>
						{thread.pinned
							? `${OWNER_NAME}에게 메시지를 보내면 나만의 대화가 생겨요.`
							: '공개 대화예요. 누구나 읽을 수 있어요.'}
					</p>
					<button type="button" onClick={onOpenMyThread}>
						{hasMyThread ? '내 대화로 가기' : thread.pinned ? '메시지 보내기' : '내 대화 시작하기'}
					</button>
				</footer>
			)}

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

/** 새 대화: 이름과 비밀번호를 정하고 첫 메시지를 보낸다 */
const NewThreadComposer: React.FC<{ onStart: (input: NewThreadInput) => Promise<InputErrors> }> = ({ onStart }) => {
	const [nickname, setNickname] = useState('');
	const [password, setPassword] = useState('');
	const [errors, setErrors] = useState<InputErrors>({});

	return (
		<Composer
			autoFocus
			error={errors.nickname ?? errors.password}
			onSend={async (text) => {
				const result = await onStart({ nickname, password, text });
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
					value={nickname}
					aria-invalid={!!errors.nickname}
					onChange={(event) => setNickname(event.target.value)}
				/>
				<input
					type="password"
					aria-label="비밀번호"
					placeholder="비밀번호 (삭제할 때 필요)"
					maxLength={LIMITS.password.max}
					value={password}
					aria-invalid={!!errors.password}
					onChange={(event) => setPassword(event.target.value)}
				/>
			</div>
		</Composer>
	);
};

export default ChatView;
