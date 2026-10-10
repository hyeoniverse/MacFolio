import { cssVars } from '@/shared/lib/cssVars';
import { prefersReducedMotion } from '@/shared/lib/media';
import React, { useEffect, useRef, useState } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { useProfile } from '@/shared/site/profileStore';
import ComposeView from './ComposeView';
import { formatMailDate, TO_OWNER, type ContactInput } from '../contact';
import { replyToMail, type ContactMail } from '../mailboxApi';
import type { SendOptions, SendResult } from '../sender';
import { MAILBOX_LABEL, type ListMail, type Mailbox } from '../model';
import { takeComposeRequest } from '../composeRequest';
import '@/apps/mail/components/MailMobile.css';

const MAILBOX_ICON: Record<Mailbox, string> = { inbox: 'fa-solid fa-inbox', sent: 'fa-regular fa-paper-plane' };

/** 지금 보는 화면: 메일상자, 한 사서함의 목록, 메일 한 통 */
type Screen =
	{ kind: 'mailboxes' } | { kind: 'list'; mailbox: Mailbox } | { kind: 'mail'; mailbox: Mailbox; id: string };
/** 화면의 깊이: 더 깊은 곳으로 가면 앞으로(오른쪽에서), 얕은 곳으로 가면 뒤로(왼쪽에서) 넘어간다 */
const DEPTH: Record<Screen['kind'], number> = { mailboxes: 0, list: 1, mail: 2 };

/** 시트가 내려가며 닫히는 시간 (CSS의 mail-phone-sheet-down과 같다). 움직임 줄이기면 바로 닫는다 */
const SHEET_CLOSE_MS = 240;

/** 아래에서 올라오는 것: 새로운 메시지, 관리자 답장, 메일 동작 */
type Sheet =
	{ kind: 'compose'; subject?: string } | { kind: 'reply'; mail: ListMail } | { kind: 'actions'; mail: ListMail };

interface Props {
	admin: boolean;
	inbox: ListMail[];
	/** 서버가 없으면 null (보낸 편지함이 없다) */
	sent: ListMail[] | null;
	loading: boolean;
	loadError: string | null;
	isUnread: (mail: ListMail) => boolean;
	onRead: (id: string, read: boolean) => void;
	onSend: (input: ContactInput, options?: SendOptions) => Promise<SendResult>;
	onReplied: (mail: ContactMail) => void;
}

/** 이름의 첫 글자 아바타 (iOS 메일처럼 둥근 네모) */
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 48 }) => (
	<span className="mail-phone-avatar" aria-hidden="true" style={cssVars({ size: `${size}px` })}>
		{Array.from(name)[0]}
	</span>
);

/** 관리자 답장 시트: 받는 사람은 그 방문자, 아래에 원래 메일을 인용한다 */
const ReplySheet: React.FC<{ mail: ListMail; onClose: () => void; onReplied: (mail: ContactMail) => void }> = ({
	mail,
	onClose,
	onReplied,
}) => {
	const [body, setBody] = useState('');
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const send = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!body.trim() || sending) return;
		setSending(true);
		setError(null);
		try {
			onReplied(await replyToMail(mail.id, body));
			onClose();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : '답장을 보내지 못했습니다.');
		} finally {
			setSending(false);
		}
	};

	return (
		<form className="mail-compose sheet" aria-label="답장 쓰기" onSubmit={send}>
			<header className="mail-sheet-head">
				<button type="button" className="mail-sheet-circle" aria-label="취소" onClick={onClose}>
					<i className="fa-solid fa-xmark" aria-hidden="true" />
				</button>
				<button
					type="submit"
					className={`mail-sheet-circle send ${body.trim() ? 'ready' : ''}`}
					aria-label="답장 보내기"
					disabled={sending}
				>
					<i className="fa-solid fa-arrow-up" aria-hidden="true" />
				</button>
			</header>
			<h2 className="mail-sheet-title">Re: {mail.subject}</h2>
			<div className="mail-compose-row">
				<span>받는 사람:</span>
				<span className="mail-phone-recipient">{mail.fromName}</span>
			</div>
			<div className="mail-compose-row">
				<span>제목:</span>
				<span>Re: {mail.subject}</span>
			</div>
			<textarea
				className="mail-compose-body"
				aria-label="답장 내용"
				placeholder={`${mail.fromName}님에게 답장`}
				value={body}
				autoFocus
				onChange={(event) => setBody(event.target.value)}
			/>
			{error && (
				<p className="mail-error" role="alert">
					{error}
				</p>
			)}
			<blockquote className="mail-phone-quote">
				<p>
					{formatMailDate(mail.date)}, {mail.fromName} &lt;{mail.fromEmail}&gt; 작성:
				</p>
				<p>{mail.body}</p>
			</blockquote>
		</form>
	);
};

/**
 * 메일 (휴대폰): iOS 메일처럼 메일상자 → 사서함 목록 → 메일 한 통으로 한 화면씩 들어간다.
 * 메일은 위에 뒤로 가기와 ↑·↓(이전·다음 메일), 아래에 답장 막대. 쓰기·답장은 아래에서 올라오는 시트,
 * 답장 단추는 먼저 메일 동작(답장, 읽지 않음으로 표시)을 띄운다
 */
const MailMobile: React.FC<Props> = ({
	admin,
	inbox,
	sent,
	loading,
	loadError,
	isUnread,
	onRead,
	onSend,
	onReplied,
}) => {
	const profile = useProfile();
	const [screen, setScreenState] = useState<Screen>({ kind: 'mailboxes' });
	// 화면이 넘어간 방향: 들어가면 오른쪽에서, 뒤로 가면 왼쪽에서 (처음에는 움직이지 않는다)
	const [direction, setDirection] = useState<'forward' | 'back' | null>(null);
	const [sheet, setSheetState] = useState<Sheet | null>(null);
	const [closing, setClosing] = useState(false);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const setScreen = (next: Screen) => {
		setDirection(DEPTH[next.kind] < DEPTH[screen.kind] ? 'back' : 'forward');
		setScreenState(next);
	};
	/** 시트 열기·바꾸기는 바로, 닫기는 내려가는 애니메이션이 끝난 뒤에 */
	const setSheet = (next: Sheet | null) => {
		if (closeTimer.current) clearTimeout(closeTimer.current);
		if (next || !sheet) {
			setClosing(false);
			setSheetState(next);
			return;
		}
		setClosing(true);
		closeTimer.current = setTimeout(
			() => {
				setSheetState(null);
				setClosing(false);
			},
			prefersReducedMotion() ? 0 : SHEET_CLOSE_MS
		);
	};
	useEffect(
		() => () => {
			if (closeTimer.current) clearTimeout(closeTimer.current);
		},
		[]
	);
	// 다른 곳(프로필의 이메일)에서 '새로운 메시지'를 열어 달라고 하면 쓰기 시트를 연다
	useEffect(() => takeComposeRequest(() => setSheetState({ kind: 'compose' })), []);
	const listOf = (mailbox: Mailbox) => (mailbox === 'inbox' ? inbox : (sent ?? []));
	const mailboxes: Mailbox[] = sent ? ['inbox', 'sent'] : ['inbox'];

	const openMail = (mailbox: Mailbox, id: string) => {
		setScreen({ kind: 'mail', mailbox, id });
		onRead(id, true);
	};

	/** 이 메일에서 할 수 있는 답장: 관리자는 받은 메일에 앱에서, 방문자는 주인에게 새 메일로 */
	const canReply = (mailbox: Mailbox, mail: ListMail) => (admin ? mail.replyable === true : mailbox === 'inbox');
	const reply = (mailbox: Mailbox, mail: ListMail) =>
		setSheet(admin ? { kind: 'reply', mail } : { kind: 'compose', subject: `Re: ${mail.subject}` });

	const navigation =
		screen.kind === 'mailboxes' ? (
			<MobileNavigation />
		) : screen.kind === 'list' ? (
			<MobileNavigation backLabel="메일상자" onBack={() => setScreen({ kind: 'mailboxes' })} />
		) : (
			<MobileNavigation
				backLabel={MAILBOX_LABEL[screen.mailbox]}
				onBack={() => setScreen({ kind: 'list', mailbox: screen.mailbox })}
			/>
		);

	const composeButton = (
		<button
			type="button"
			className="mail-phone-compose-button"
			aria-label="새로운 메시지"
			onClick={() => setSheet({ kind: 'compose' })}
		>
			<i className="fa-regular fa-pen-to-square" aria-hidden="true" />
		</button>
	);

	let body: React.ReactNode;
	if (screen.kind === 'mailboxes') {
		body = (
			<div className="mail-phone-scroll">
				<h2 className="phone-title">메일상자</h2>
				<p className="phone-title-sub">
					{loadError ? '업데이트하지 못함' : loading ? '불러오는 중…' : '지금 업데이트됨'}
				</p>
				<ul className="mail-phone-group" aria-label="메일상자">
					{mailboxes.map((mailbox) => {
						const count = mailbox === 'inbox' ? inbox.filter(isUnread).length : (sent?.length ?? 0);
						return (
							<li key={mailbox}>
								<button type="button" onClick={() => setScreen({ kind: 'list', mailbox })}>
									<i className={MAILBOX_ICON[mailbox]} aria-hidden="true" />
									<span className="mail-phone-group-name">{MAILBOX_LABEL[mailbox]}</span>
									{count > 0 && <span className="mail-phone-group-count">{count}</span>}
									<i className="fa-solid fa-chevron-right mail-phone-chevron" aria-hidden="true" />
								</button>
							</li>
						);
					})}
				</ul>
				{loadError && (
					<p className="mail-error" role="alert">
						{loadError}
					</p>
				)}
			</div>
		);
	} else if (screen.kind === 'list') {
		const mails = listOf(screen.mailbox);
		body = (
			<section className="mail-phone-scroll" aria-label={MAILBOX_LABEL[screen.mailbox]}>
				<h2 className="phone-title">{MAILBOX_LABEL[screen.mailbox]}</h2>
				<p className="phone-title-sub">메일 {mails.length}통</p>
				{mails.length === 0 ? (
					<p className="mail-phone-empty">
						{screen.mailbox === 'sent'
							? '보낸 메일이 없습니다. 이 브라우저에서 보낸 메일만 보입니다.'
							: loading
								? '불러오는 중…'
								: '받은 메일이 없습니다.'}
					</p>
				) : (
					<ul className="mail-phone-list">
						{mails.map((mail) => (
							<li key={mail.id}>
								<button type="button" className="mail-phone-item" onClick={() => openMail(screen.mailbox, mail.id)}>
									<span
										className={`mail-phone-unread ${screen.mailbox === 'inbox' && isUnread(mail) ? '' : 'read'}`}
										aria-hidden="true"
									/>
									<span className="mail-phone-item-text">
										<span className="mail-phone-item-top">
											<strong>{screen.mailbox === 'sent' ? profile.name : mail.fromName}</strong>
											<time dateTime={mail.date}>{formatMailDate(mail.date)}</time>
										</span>
										<span className="mail-phone-item-subject">
											{mail.subject}
											{mail.replies.length > 0 && (
												<span className="mail-replied">
													<i className="fa-solid fa-reply" aria-hidden="true" /> 답장 {mail.replies.length}
												</span>
											)}
										</span>
										<span className="mail-phone-item-preview">{mail.body}</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
		);
	} else {
		const mails = listOf(screen.mailbox);
		const index = mails.findIndex((mail) => mail.id === screen.id);
		const mail = mails[index];
		body = mail ? (
			<>
				{/* 오른쪽 위: 이전·다음 메일 */}
				<div className="mail-phone-updown" role="group" aria-label="메일 넘기기">
					<button
						type="button"
						aria-label="이전 메일"
						disabled={index <= 0}
						onClick={() => openMail(screen.mailbox, mails[index - 1].id)}
					>
						<i className="fa-solid fa-chevron-up" aria-hidden="true" />
					</button>
					<button
						type="button"
						aria-label="다음 메일"
						disabled={index >= mails.length - 1}
						onClick={() => openMail(screen.mailbox, mails[index + 1].id)}
					>
						<i className="fa-solid fa-chevron-down" aria-hidden="true" />
					</button>
				</div>
				<article key={mail.id} className="mail-phone-scroll mail-phone-article" aria-label={mail.subject}>
					<header className="mail-phone-header">
						<Avatar name={mail.fromName} />
						<div>
							<strong>{mail.fromName}</strong>
							<p>
								받는 사람:{' '}
								<span className="mail-phone-to">{mail.to === TO_OWNER ? profile.name : mail.to.split(' <')[0]}</span>
							</p>
						</div>
						<time dateTime={mail.date}>{formatMailDate(mail.date)}</time>
					</header>
					<h1>{mail.subject}</h1>
					<p className="mail-phone-body">{mail.body}</p>
					{mail.replies.length > 0 && (
						<ol className="mail-thread" aria-label="답장">
							{mail.replies.map((entry) => (
								<li key={entry.id} className="mail-thread-reply">
									<header>
										<Avatar name={profile.name} size={32} />
										<strong>{profile.name}</strong>
										<time dateTime={entry.createdAt}>{formatMailDate(entry.createdAt)}</time>
									</header>
									<p className="mail-phone-body">{entry.body}</p>
								</li>
							))}
						</ol>
					)}
				</article>
				<div className="mail-phone-bar">
					{canReply(screen.mailbox, mail) ? (
						<button
							type="button"
							className="mail-phone-pill"
							aria-label="답장"
							onClick={() => setSheet({ kind: 'actions', mail })}
						>
							<i className="fa-solid fa-reply" aria-hidden="true" />
						</button>
					) : (
						<span />
					)}
					{composeButton}
				</div>
			</>
		) : (
			<p className="mail-phone-empty">메일을 찾을 수 없습니다.</p>
		);
	}

	const screenMailbox = screen.kind === 'mailboxes' ? 'inbox' : screen.mailbox;

	const pageKey =
		screen.kind === 'mailboxes' ? 'mailboxes' : screen.kind === 'list' ? `list:${screen.mailbox}` : `mail:${screen.id}`;

	return (
		<div className="mail-phone" data-screen={screen.kind}>
			{navigation}
			{/* 화면마다 새로 그려 넘어가는 애니메이션을 다시 돌린다 (방향은 data-direction) */}
			<div key={pageKey} className="mail-phone-page" data-direction={direction ?? undefined}>
				{body}
				{screen.kind !== 'mail' && <div className="mail-phone-bar end">{composeButton}</div>}
			</div>

			{sheet && (
				<div
					className={`mail-phone-sheet-layer ${closing ? 'closing' : ''}`}
					onClick={(event) => event.target === event.currentTarget && setSheet(null)}
				>
					{sheet.kind === 'actions' ? (
						<section className="mail-phone-actions" role="dialog" aria-label="메일 동작">
							<header>
								<Avatar name={sheet.mail.fromName} size={44} />
								<div>
									<strong>{sheet.mail.fromName}</strong>
									<p>{sheet.mail.body}</p>
								</div>
								<button type="button" className="mail-sheet-circle" aria-label="닫기" onClick={() => setSheet(null)}>
									<i className="fa-solid fa-xmark" aria-hidden="true" />
								</button>
							</header>
							<div className="mail-phone-tiles">
								<button type="button" onClick={() => reply(screenMailbox, sheet.mail)}>
									<i className="fa-solid fa-reply" aria-hidden="true" />
									답장
								</button>
							</div>
							{!admin && screenMailbox === 'inbox' && (
								<ul className="mail-phone-action-list">
									<li>
										<button
											type="button"
											onClick={() => {
												onRead(sheet.mail.id, false);
												setSheet(null);
												setScreen({ kind: 'list', mailbox: 'inbox' });
											}}
										>
											읽지 않음으로 표시
											<i className="fa-regular fa-envelope" aria-hidden="true" />
										</button>
									</li>
								</ul>
							)}
						</section>
					) : (
						<div
							className="mail-phone-sheet"
							role="dialog"
							aria-label={sheet.kind === 'reply' ? '답장' : '새로운 메시지'}
						>
							<span className="mail-phone-grabber" aria-hidden="true" />
							{sheet.kind === 'reply' ? (
								<ReplySheet mail={sheet.mail} onClose={() => setSheet(null)} onReplied={onReplied} />
							) : (
								<ComposeView sheet initialSubject={sheet.subject} onSend={onSend} onCancel={() => setSheet(null)} />
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default MailMobile;
