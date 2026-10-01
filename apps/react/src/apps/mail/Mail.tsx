import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { PROFILE } from '@/shared/profile';
import ComposeView from './components/ComposeView';
import { formatMailDate, INBOX } from './contact';
import { getMailSender } from './sender';
import '@/apps/mail/Mail.css';
import IconButton from '@/shared/ui/button/IconButton';

/** 이름의 첫 글자 아바타 */
const Monogram: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => (
	<span className="mail-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.44 }}>
		{Array.from(name)[0]}
	</span>
);

/**
 * 메일: 방문자가 사이트 주인에게 연락 메일을 보내는 앱. macOS 메일처럼 메일상자 · 목록 · 읽기 세 칸.
 * 보내기는 MailSender가 맡는다 (지금은 메일 앱 열기, 백엔드 #9 이후에는 서버 발송).
 */
const Mail: React.FC = () => {
	const [selectedId, setSelectedId] = useState<string | null>(INBOX[0]?.id ?? null);
	// 처음 보여 주는 메일은 읽은 것으로 친다
	const [readIds, setReadIds] = useState<Set<string>>(() => new Set(INBOX[0] ? [INBOX[0].id] : []));
	const [composing, setComposing] = useState(false);
	// 좁은 창에서는 목록과 읽기(쓰기)를 한 화면씩 보여준다. 넓은 창에서는 쓰지 않는다.
	const [detailOpen, setDetailOpen] = useState(false);
	// 넘어간 방향 (처음에는 애니메이션 없음)
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();
	const selected = INBOX.find((mail) => mail.id === selectedId) ?? null;
	const unread = INBOX.filter((mail) => !readIds.has(mail.id)).length;

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

	return (
		<AppWindow title="메일" appName="mail" chrome="unified">
			{/* 모바일 제목 막대의 뒤로 가기 (iOS처럼 화면마다 하나) */}
			<MobileNavigation {...(detailOpen ? { backLabel: '받은 편지함', onBack: backToList } : {})} />
			<div className="mail-shell">
				<div className={`mail ${detailOpen ? 'detail-open' : ''}`} data-nav={nav}>
					<aside className="mail-sidebar" aria-label="메일상자">
						<div className="mail-sidebar-top" />
						<p className="mail-sidebar-heading">메일상자</p>
						<button type="button" className="mail-mailbox selected" aria-current="true">
							<i className="fa-solid fa-inbox" aria-hidden="true" />
							<span>받은 편지함</span>
							{unread > 0 && <span className="mail-badge">{unread}</span>}
						</button>
					</aside>

					<section className="mail-list" aria-label="받은 편지함">
						<header className="mail-list-toolbar">
							<div>
								<h2>받은 편지함</h2>
								<p>메일 {INBOX.length}통</p>
							</div>
							<IconButton variant="float" label="새로운 메시지" onClick={compose} icon="fa-regular fa-pen-to-square" />
						</header>
						<ul>
							{INBOX.map((mail) => (
								<li key={mail.id}>
									<button
										type="button"
										className={`mail-item ${!composing && selectedId === mail.id ? 'selected' : ''}`}
										aria-current={(!composing && selectedId === mail.id) || undefined}
										onClick={() => open(mail.id)}
									>
										<span className={`mail-unread ${readIds.has(mail.id) ? 'read' : ''}`} aria-hidden="true" />
										<span className="mail-item-text">
											<span className="mail-item-top">
												<strong>{mail.fromName}</strong>
												<time dateTime={mail.date}>{formatMailDate(mail.date)}</time>
											</span>
											<span className="mail-item-subject">{mail.subject}</span>
											<span className="mail-item-preview">{mail.body}</span>
										</span>
									</button>
								</li>
							))}
						</ul>
					</section>

					<section className="mail-reader">
						<button type="button" className="mail-back" onClick={backToList}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 받은 편지함
						</button>
						{composing ? (
							<ComposeView onSend={(input) => getMailSender().send(input)} onCancel={backToList} />
						) : selected ? (
							<article key={selected.id} className="mail-reader-article" aria-label={selected.subject}>
								<header className="mail-reader-header">
									<Monogram name={selected.fromName} />
									<div>
										<strong>{selected.fromName}</strong>
										<p>{selected.fromEmail}</p>
										<p>받는 사람: 방문자님</p>
									</div>
									<time dateTime={selected.date}>{formatMailDate(selected.date)}</time>
								</header>
								<h1>{selected.subject}</h1>
								<p className="mail-reader-body">{selected.body}</p>
								<button type="button" className="mail-button primary" onClick={compose}>
									<i className="fa-solid fa-reply" aria-hidden="true" /> {PROFILE.name}에게 답장
								</button>
							</article>
						) : (
							<p className="mail-empty">선택된 메시지 없음</p>
						)}
					</section>
				</div>
			</div>
		</AppWindow>
	);
};

export default Mail;
