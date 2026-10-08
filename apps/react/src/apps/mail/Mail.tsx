import { cssVars } from '@/shared/lib/cssVars';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import React, { useEffect, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import { PROFILE } from '@/shared/profile';
import ComposeView from './components/ComposeView';
import MailMobile from './components/MailMobile';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { formatMailDate, INBOX } from './contact';
import { fetchReceivedMail, fetchSentMail, replyToMail, type ContactMail } from './mailboxApi';
import { getMailSender, type SendOptions } from './sender';
import type { ContactInput } from './contact';
import '@/apps/mail/Mail.css';
import IconButton from '@/shared/ui/button/IconButton';
import Button from '@/shared/ui/button/Button';

export type Mailbox = 'inbox' | 'sent';
const MAILBOX_LABEL: Record<Mailbox, string> = { inbox: '받은 편지함', sent: '보낸 편지함' };

/** 목록과 읽기 칸이 함께 쓰는 메일 한 통 */
export interface ListMail {
	id: string;
	fromName: string;
	fromEmail: string;
	/** 받는 사람 (읽기 칸에 보인다) */
	to: string;
	subject: string;
	/** ISO 8601 */
	date: string;
	body: string;
	/** 사이트 주인의 답장 (서버에 저장된 메일만) */
	replies: { id: string; body: string; createdAt: string }[];
	/** 서버에 저장된 받은 메일: 관리자가 앱에서 답장한다 */
	replyable?: boolean;
}

const OWNER = `${PROFILE.name} <${PROFILE.email}>`;

const fromServer = (mail: ContactMail, replyable: boolean): ListMail => ({
	id: mail.id,
	fromName: mail.name,
	fromEmail: mail.email,
	to: OWNER,
	subject: mail.subject,
	date: mail.createdAt,
	body: mail.body,
	replies: mail.replies,
	replyable,
});

/** 방문자의 받은 편지함: 사이트 주인의 환영 메일 */
const WELCOME: ListMail[] = INBOX.map((mail) => ({ ...mail, to: '방문자님', replies: [] }));

/** 이름의 첫 글자 아바타 */
const Monogram: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => (
	<span className="mail-avatar" aria-hidden="true" style={cssVars({ size: `${size}px` })}>
		{Array.from(name)[0]}
	</span>
);

/** 관리자 답장 쓰기: 방문자의 메일 주소로 보내고, 이 메일 아래에 붙는다 */
const ReplyBox: React.FC<{ mail: ListMail; onReplied: (mail: ContactMail) => void }> = ({ mail, onReplied }) => {
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
			setBody('');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : '답장을 보내지 못했습니다.');
		} finally {
			setSending(false);
		}
	};

	return (
		<form className="mail-reply-box" aria-label="답장 쓰기" onSubmit={send}>
			<p>
				받는 사람: {mail.fromName} &lt;{mail.fromEmail}&gt;
			</p>
			<textarea
				aria-label="답장 내용"
				placeholder={`${mail.fromName}님에게 답장`}
				value={body}
				onChange={(event) => setBody(event.target.value)}
			/>
			{error && (
				<p className="mail-error" role="alert">
					{error}
				</p>
			)}
			<Button tone="primary" type="submit" disabled={sending || !body.trim()}>
				<i className="fa-solid fa-reply" aria-hidden="true" /> {sending ? '보내는 중…' : '답장 보내기'}
			</Button>
		</form>
	);
};

/**
 * 메일: 방문자가 사이트 주인에게 연락 메일을 보내는 앱. macOS 메일처럼 메일상자 · 목록 · 읽기 세 칸.
 * - 방문자: 받은 편지함(환영 메일), 보낸 편지함(이 브라우저가 보낸 메일과 주인의 답장. 서버가 방문자 쿠키로 거른다)
 * - 관리자: 받은 편지함에 받은 모든 메일. 읽기 칸에서 바로 답장한다 (#25)
 * 보내기는 MailSender가 맡는다 (서버에 메일 설정이 없으면 방문자의 메일 앱을 연다)
 */
const Mail: React.FC = () => {
	const admin = useAdmin().status === 'signed-in';
	const mobile = useIsMobile();
	const [mailbox, setMailbox] = useState<Mailbox>('inbox');
	const [received, setReceived] = useState<ListMail[] | null>(null);
	const [sent, setSent] = useState<ListMail[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [refreshes, setRefreshes] = useState(0);
	const [selectedId, setSelectedId] = useState<string | null>(WELCOME[0]?.id ?? null);
	// 처음 보여 주는 메일은 읽은 것으로 친다
	const [readIds, setReadIds] = useState<Set<string>>(() => new Set(WELCOME[0] ? [WELCOME[0].id] : []));
	const [composing, setComposing] = useState(false);
	// 좁은 창에서는 목록과 읽기(쓰기)를 한 화면씩 보여준다. 넓은 창에서는 쓰지 않는다.
	const [detailOpen, setDetailOpen] = useState(false);
	// 넘어간 방향 (처음에는 애니메이션 없음)
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();

	// 서버의 사서함: 보낸 편지함(누구나, 이 브라우저 것만), 받은 편지함(관리자)
	useEffect(() => {
		if (!env.apiUrl) return;
		let alive = true;
		const failed = (error: Error) => alive && setLoadError(error.message);
		void fetchSentMail()
			.then((mails) => {
				if (!alive) return;
				setSent(mails.map((mail) => fromServer(mail, false)));
				setLoadError(null);
			})
			.catch(failed);
		// 관리자가 아니면 받은 편지함은 환영 메일이라 묻지 않는다 (서버도 401)
		if (admin)
			void fetchReceivedMail()
				.then((mails) => alive && setReceived(mails.map((mail) => fromServer(mail, true))))
				.catch(failed);
		return () => {
			alive = false;
		};
	}, [admin, refreshes]);

	const inbox = admin ? (received ?? []) : WELCOME;
	const mails = mailbox === 'inbox' ? inbox : (sent ?? []);
	const selected = mails.find((mail) => mail.id === selectedId) ?? null;
	// 안 읽은 메일: 관리자는 아직 답장하지 않은 메일, 방문자는 열어 보지 않은 메일
	const isUnread = (mail: ListMail) => (admin ? mail.replies.length === 0 : !readIds.has(mail.id));
	const unread = inbox.filter(isUnread).length;

	const open = (id: string) => {
		setSelectedId(id);
		setReadIds((prev) => new Set(prev).add(id));
		setComposing(false);
		setDetailOpen(true);
		setNav('forward');
	};

	const compose = () => {
		setComposing(true);
		setDetailOpen(true);
		setNav('forward');
	};

	const backToList = () => {
		setComposing(false);
		setDetailOpen(false);
		setNav('back');
	};

	const showMailbox = (next: Mailbox) => {
		setMailbox(next);
		setSelectedId((next === 'inbox' ? inbox : (sent ?? []))[0]?.id ?? null);
		backToList();
	};

	// 서버가 보냈으면 보낸 편지함을 다시 읽는다
	const send = async (input: ContactInput, options?: SendOptions) => {
		const result = await getMailSender().send(input, options);
		if (result.status === 'sent') setRefreshes((count) => count + 1);
		return result;
	};

	const replied = (mail: ContactMail) =>
		setReceived((current) => current?.map((entry) => (entry.id === mail.id ? fromServer(mail, true) : entry)) ?? null);

	// 메뉴 막대의 메일 메뉴 (#96)
	useAppMenus('mail', [
		{
			title: '파일',
			items: [
				{
					label: '새로운 메시지',
					icon: 'fa-regular fa-pen-to-square',
					shortcut: { code: 'KeyN', alt: true },
					onSelect: compose,
				},
			],
		},
		{
			title: '사서함',
			items: [
				{ label: '받은 편지함', checked: mailbox === 'inbox', onSelect: () => showMailbox('inbox') },
				...(env.apiUrl
					? [{ label: '보낸 편지함', checked: mailbox === 'sent', onSelect: () => showMailbox('sent') }]
					: []),
			],
		},
	]);

	const emptyText =
		mailbox === 'sent'
			? '보낸 메일이 없습니다. 이 브라우저에서 보낸 메일만 보입니다.'
			: admin && received === null
				? '불러오는 중…'
				: '받은 메일이 없습니다.';

	return (
		<AppWindow title="메일" appName="mail" chrome="unified">
			{/* 휴대폰은 iOS 메일처럼 따로 짠다 (MailMobile): 메일상자 → 목록 → 메일, 쓰기는 아래에서 올라오는 시트 */}
			{mobile ? (
				<MailMobile
					admin={admin}
					inbox={inbox}
					sent={env.apiUrl ? (sent ?? []) : null}
					loading={admin && received === null && !loadError}
					loadError={loadError}
					isUnread={isUnread}
					onRead={(id, read) =>
						setReadIds((prev) => {
							const next = new Set(prev);
							if (read) next.add(id);
							else next.delete(id);
							return next;
						})
					}
					onSend={send}
					onReplied={replied}
				/>
			) : (
				<div className="mail-shell">
					<div className={`mail ${detailOpen ? 'detail-open' : ''}`} data-nav={nav}>
						<aside className="mail-sidebar" aria-label="메일상자">
							<div className="mail-sidebar-top" />
							<p className="mail-sidebar-heading">메일상자</p>
							<button
								type="button"
								className={`mail-mailbox ${mailbox === 'inbox' ? 'selected' : ''}`}
								aria-current={mailbox === 'inbox' || undefined}
								onClick={() => showMailbox('inbox')}
							>
								<i className="fa-solid fa-inbox" aria-hidden="true" />
								<span>받은 편지함</span>
								{unread > 0 && <span className="mail-badge">{unread}</span>}
							</button>
							{env.apiUrl && (
								<button
									type="button"
									className={`mail-mailbox ${mailbox === 'sent' ? 'selected' : ''}`}
									aria-current={mailbox === 'sent' || undefined}
									onClick={() => showMailbox('sent')}
								>
									<i className="fa-solid fa-paper-plane" aria-hidden="true" />
									<span>보낸 편지함</span>
								</button>
							)}
						</aside>

						<section className="mail-list" aria-label={MAILBOX_LABEL[mailbox]}>
							<header className="mail-list-toolbar">
								<div>
									<h2 className="phone-title">{MAILBOX_LABEL[mailbox]}</h2>
									<p>메일 {mails.length}통</p>
								</div>
								<IconButton
									variant="float"
									label="새로운 메시지"
									onClick={compose}
									icon="fa-regular fa-pen-to-square"
								/>
							</header>
							{/* 휴대폰: 사이드바 대신 사서함을 위에서 고른다 */}
							{env.apiUrl && (
								<div className="mail-mailbox-tabs" role="tablist" aria-label="사서함">
									{(['inbox', 'sent'] as const).map((entry) => (
										<button
											key={entry}
											type="button"
											role="tab"
											aria-selected={mailbox === entry}
											onClick={() => showMailbox(entry)}
										>
											{MAILBOX_LABEL[entry]}
										</button>
									))}
								</div>
							)}
							{loadError && (
								<p className="mail-error" role="alert">
									{loadError}
								</p>
							)}
							{mails.length === 0 ? (
								<p className="mail-list-empty">{emptyText}</p>
							) : (
								// 사서함을 바꾸면 목록이 서서히 바뀐다
								<ul key={mailbox} className="motion-swap">
									{mails.map((mail) => (
										<li key={mail.id}>
											<button
												type="button"
												className={`mail-item ${!composing && selectedId === mail.id ? 'selected' : ''}`}
												aria-current={(!composing && selectedId === mail.id) || undefined}
												onClick={() => open(mail.id)}
											>
												<span
													className={`mail-unread ${mailbox === 'sent' || !isUnread(mail) ? 'read' : ''}`}
													aria-hidden="true"
												/>
												<span className="mail-item-text">
													<span className="mail-item-top">
														<strong>{mailbox === 'sent' ? PROFILE.name : mail.fromName}</strong>
														<time dateTime={mail.date}>{formatMailDate(mail.date)}</time>
													</span>
													<span className="mail-item-subject">
														{mail.subject}
														{mail.replies.length > 0 && (
															<span className="mail-replied">
																<i className="fa-solid fa-reply" aria-hidden="true" /> 답장 {mail.replies.length}
															</span>
														)}
													</span>
													<span className="mail-item-preview">{mail.body}</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</section>

						<section className="mail-reader">
							<button type="button" className="mail-back" onClick={backToList}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {MAILBOX_LABEL[mailbox]}
							</button>
							{composing ? (
								<ComposeView onSend={send} onCancel={backToList} />
							) : selected ? (
								<article key={selected.id} className="mail-reader-article" aria-label={selected.subject}>
									<header className="mail-reader-header">
										<Monogram name={selected.fromName} />
										<div>
											<strong>{selected.fromName}</strong>
											<p>{selected.fromEmail}</p>
											<p>받는 사람: {selected.to}</p>
										</div>
										<time dateTime={selected.date}>{formatMailDate(selected.date)}</time>
									</header>
									<h1>{selected.subject}</h1>
									<p className="mail-reader-body">{selected.body}</p>
									{selected.replies.length > 0 && (
										<ol className="mail-thread" aria-label="답장">
											{selected.replies.map((reply) => (
												<li key={reply.id} className="mail-thread-reply">
													<header>
														<Monogram name={PROFILE.name} size={28} />
														<strong>{PROFILE.name}</strong>
														<time dateTime={reply.createdAt}>{formatMailDate(reply.createdAt)}</time>
													</header>
													<p className="mail-reader-body">{reply.body}</p>
												</li>
											))}
										</ol>
									)}
									{selected.replyable ? (
										<ReplyBox key={selected.id} mail={selected} onReplied={replied} />
									) : mailbox === 'inbox' ? (
										<Button tone="primary" onClick={compose}>
											<i className="fa-solid fa-reply" aria-hidden="true" /> {PROFILE.name}에게 답장
										</Button>
									) : null}
								</article>
							) : (
								<p className="mail-empty">선택된 메시지 없음</p>
							)}
						</section>
					</div>
				</div>
			)}
		</AppWindow>
	);
};

export default Mail;
