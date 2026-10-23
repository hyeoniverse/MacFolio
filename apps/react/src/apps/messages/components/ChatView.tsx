import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Composer from './Composer';
import Menu from '@/shared/ui/menu/Menu';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { useAdmin } from '@/shared/auth/adminStore';
import {
	buildTimeline,
	COMPOSE_TEXT,
	displayName,
	type ComposeKind,
	type Message,
	type Thread,
} from '../conversations';
import IssueLink from './IssueLink';
import type { DeleteResult } from '../repository';
import IconButton from '@/shared/ui/button/IconButton';
import Turnstile from '@/shared/ui/turnstile/Turnstile';
import { useHumanCheck } from '@/shared/security/security';
import { env } from '@/shared/config/env';
import Button from '@/shared/ui/button/Button';

interface Props {
	/** null이면 새 피드백을 남기는 화면 */
	thread: Thread | null;
	messages: Message[];
	/** 이 브라우저의 이름 (예: 🦊 날쌘 여우). 이름·비밀번호는 받지 않는다 */
	myName: string | null;
	focusRequest: number;
	/** 새 피드백 화면을 연 경로 (안내 문구와 자리표시자가 다르다) */
	composeKind: ComposeKind;
	/** 좁은 창에서 대화 목록으로 돌아가기 */
	onBack: () => void;
	/** 새 피드백을 그만두기 */
	onCancelNew: () => void;
	onCompose: () => void;
	onSend: (text: string, turnstileToken?: string) => Promise<{ text?: string }>;
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

/** 맨 아래에서 이만큼(px) 안이면 맨 아래를 보고 있다고 본다 (새 말풍선이 오면 따라 내려간다) */
const STICK_PX = 48;

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
	composeKind,
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
	/** 사람 확인: 관리자가 시스템 설정에서 메시지에 켜면 (서버에 저장할 때만, 관리자에게는 없다) */
	const humanCheck = useHumanCheck('message');
	const human = env.messagesStore === 'local' ? { ...humanCheck, siteKey: null, ready: true } : humanCheck;
	const canDelete = (message: Message) => !message.fromOwner && (message.mine || isAdmin);
	const transcript = useRef<HTMLDivElement>(null);
	/** 맨 아래를 보고 있는지. 위로 올려 지난 말풍선을 읽는 중이면 false */
	const atBottom = useRef(true);
	const timeline = buildTimeline(messages, { now: new Date() });
	const last = messages.at(-1);

	const scrollToEnd = () => {
		const list = transcript.current;
		if (list) list.scrollTop = list.scrollHeight;
	};

	// 항목을 열면 맨 아래로
	useEffect(() => {
		atBottom.current = true;
		scrollToEnd();
	}, [thread?.id]);
	// 새 말풍선이 오면(내가 보냈거나 주기 조회로 받은 답글): 맨 아래를 보고 있었거나 내가 보낸 것일 때만 따라 내려간다.
	// 위로 올려 읽는 중이면 스크롤 위치를 그대로 둔다
	useEffect(() => {
		if (atBottom.current || last?.mine) scrollToEnd();
	}, [last?.id, last?.mine]);
	// 휴대폰에서는 머리가 대화 위에 떠 있는 반투명 막대라(Messages.css), 대화 칸의 위 여백을 머리 높이(--chat-header-height)만큼 둔다.
	// 첫 말풍선은 머리 아래에서 시작하고, 스크롤하면 머리 뒤로 흐리게 지나간다. 머리 높이는 설명 줄 수에 따라 달라 직접 잰다
	const section = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	useLayoutEffect(() => {
		const element = header.current;
		const target = section.current;
		if (!element || !target) return;
		const update = () => target.style.setProperty('--chat-header-height', `${element.offsetHeight}px`);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
		// ChatView는 대화마다 key로 새로 그려지므로 처음 한 번만 건다
	}, []);
	// 대화 칸이 줄면(휴대폰에서 화면 키보드가 올라와 앱 화면이 보이는 곳에 맞춰질 때) 맨 아래를 보고 있었으면 마지막 말풍선을 입력 칸 위에 둔다
	useEffect(() => {
		const list = transcript.current;
		if (!list) return;
		const observer = new ResizeObserver(() => {
			if (atBottom.current) scrollToEnd();
		});
		observer.observe(list);
		return () => observer.disconnect();
	}, []);

	// 새 피드백 화면은 Esc로 그만둔다 (팝업이 열려 있으면 팝업이 먼저 닫힌다)
	useEffect(() => {
		if (thread) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
			event.preventDefault();
			onCancelNew();
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
			ref={section}
			// 다른 대화를 고르면 서서히 바뀐다 (좁은 창은 Messages.css의 nav-forward)
			className="messages-chat motion-swap"
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
				<header ref={header} className="messages-chat-header">
					<Avatar name={thread.title} />
					<span className="messages-name-pill">
						{displayName(thread.title, thread.ipPrefix)}
						{thread.mine && <span className="messages-me-badge">나</span>}
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</span>
					{subtitleOf(thread) && <span className="messages-chat-subtitle">{subtitleOf(thread)}</span>}
				</header>
			) : (
				<header ref={header} className="messages-chat-header">
					<span className="messages-name-pill">새 피드백</span>
					<span className="messages-chat-subtitle">{COMPOSE_TEXT[composeKind].subtitle}</span>
					{/* 코드와 함께 추적할 버그는 저장소의 이슈로도 받는다 */}
					<IssueLink className="messages-chat-issue" />
					<Button className="messages-cancel" onClick={onCancelNew}>
						취소
					</Button>
				</header>
			)}

			<div
				ref={transcript}
				className="messages-transcript"
				role="log"
				aria-live="polite"
				onScroll={(event) => {
					const list = event.currentTarget;
					atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_PX;
				}}
			>
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
			</div>

			<Composer
				key={focusRequest}
				placeholder={thread ? '답글' : COMPOSE_TEXT[composeKind].placeholder}
				autoFocus={focusRequest > 0}
				onSend={async (text) => {
					if (!human.ready) return { sent: false, error: '사람인지 확인하는 칸이 끝날 때까지 기다려 주세요.' };
					const result = await onSend(text, human.token ?? undefined);
					// 토큰은 한 번만 쓸 수 있다: 다음 메시지를 위해 새로 받는다
					if (human.siteKey) human.reset();
					return { sent: !result.text, error: result.text };
				}}
			>
				{human.siteKey && (
					<Turnstile
						className="messages-turnstile"
						siteKey={human.siteKey}
						resetKey={human.resetKey}
						onToken={human.setToken}
					/>
				)}
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
