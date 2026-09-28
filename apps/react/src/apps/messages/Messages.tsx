import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import Modal from '@/shared/ui/Modal';
import { groupByDay, LIMITS, type GuestbookEntry, type GuestbookInputErrors } from './guestbook';
import { useGuestbook } from './useGuestbook';
import '@/apps/messages/Messages.css';

const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

const EMPTY_FORM = { nickname: '', message: '', password: '' };

const Messages: React.FC = () => {
	const { entries, status, create, remove } = useGuestbook();
	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState<GuestbookInputErrors>({});
	const [isSending, setIsSending] = useState(false);
	const [deleting, setDeleting] = useState<GuestbookEntry | null>(null);
	const listEnd = useRef<HTMLDivElement>(null);

	// 새 글이 생기면 맨 아래로 스크롤한다
	useEffect(() => {
		listEnd.current?.scrollIntoView({ block: 'end' });
	}, [entries.length]);

	const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
		setForm((prev) => ({ ...prev, [field]: event.target.value }));

	const submit = async (event?: React.FormEvent) => {
		event?.preventDefault();
		if (isSending) return;
		setIsSending(true);
		try {
			const result = await create(form);
			setErrors(result);
			// 닉네임과 비밀번호는 이어서 쓸 수 있게 남긴다
			if (Object.keys(result).length === 0) setForm((prev) => ({ ...prev, message: '' }));
		} finally {
			setIsSending(false);
		}
	};

	const firstError = errors.nickname ?? errors.password ?? errors.message;

	return (
		<AppWindow title="Messages" appName="messages">
			<div className="messages">
				<aside className="messages-sidebar" aria-label="대화 목록">
					<div className="messages-conversation active">
						<span className="messages-avatar" aria-hidden="true">
							<i className="fa-solid fa-book-open" />
						</span>
						<div>
							<strong>방명록</strong>
							<p>{entries.length}개의 메시지</p>
						</div>
					</div>
				</aside>

				<section className="messages-chat" aria-label="방명록">
					<header className="messages-header">
						<strong>방명록</strong>
						<span>누구나 글을 남길 수 있어요</span>
					</header>

					<div className="messages-list" role="log" aria-live="polite">
						{status === 'loading' && <p className="messages-status">불러오는 중…</p>}
						{status === 'error' && <p className="messages-status">방명록을 불러오지 못했습니다.</p>}
						{groupByDay(entries).map(({ day, entries: dayEntries }) => (
							<div key={day}>
								<p className="messages-day">{day}</p>
								{dayEntries.map((entry) => (
									<article
										key={entry.id}
										className={`message ${entry.isOwner ? 'from-owner' : 'from-visitor'}`}
										aria-label={`${entry.nickname}의 메시지`}
									>
										<span className="message-nickname">{entry.nickname}</span>
										<div className="message-row">
											<p className="message-bubble">{entry.message}</p>
											<time dateTime={entry.createdAt}>{timeFormat.format(new Date(entry.createdAt))}</time>
											{!entry.isOwner && (
												<button
													type="button"
													className="message-delete"
													aria-label={`${entry.nickname}의 메시지 삭제`}
													onClick={() => setDeleting(entry)}
												>
													<i className="fa-solid fa-xmark" aria-hidden="true" />
												</button>
											)}
										</div>
									</article>
								))}
							</div>
						))}
						<div ref={listEnd} />
					</div>

					<form className="messages-composer" onSubmit={submit}>
						<div className="messages-composer-meta">
							<input
								aria-label="닉네임"
								placeholder="닉네임"
								maxLength={LIMITS.nickname.max}
								value={form.nickname}
								onChange={update('nickname')}
								aria-invalid={!!errors.nickname}
							/>
							<input
								type="password"
								aria-label="비밀번호"
								placeholder="삭제용 비밀번호"
								maxLength={LIMITS.password.max}
								value={form.password}
								onChange={update('password')}
								aria-invalid={!!errors.password}
							/>
						</div>
						<div className="messages-composer-row">
							<textarea
								aria-label="메시지"
								placeholder="메시지를 입력하세요 (Enter로 보내기, Shift+Enter로 줄바꿈)"
								rows={1}
								maxLength={LIMITS.message.max}
								value={form.message}
								onChange={update('message')}
								onKeyDown={(event) => {
									if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
										event.preventDefault();
										void submit();
									}
								}}
								aria-invalid={!!errors.message}
							/>
							<button type="submit" className="messages-send" aria-label="보내기" disabled={isSending}>
								<i className="fa-solid fa-arrow-up" aria-hidden="true" />
							</button>
						</div>
						{firstError && (
							<p className="messages-error" role="alert">
								{firstError}
							</p>
						)}
					</form>
				</section>
			</div>

			{deleting && (
				<DeleteDialog
					entry={deleting}
					onClose={() => setDeleting(null)}
					onDelete={(password) => remove(deleting.id, password)}
				/>
			)}
		</AppWindow>
	);
};

const DeleteDialog: React.FC<{
	entry: GuestbookEntry;
	onClose: () => void;
	onDelete: (password: string) => Promise<string>;
}> = ({ entry, onClose, onDelete }) => {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');

	const confirm = async (event: React.FormEvent) => {
		event.preventDefault();
		const result = await onDelete(password);
		if (result === 'deleted') onClose();
		else setError(result === 'wrong-password' ? '비밀번호가 일치하지 않습니다.' : '이미 삭제된 메시지입니다.');
	};

	return (
		<Modal title="메시지 삭제" onClose={onClose}>
			<form className="messages-delete-form" onSubmit={confirm}>
				<p>&lsquo;{entry.nickname}&rsquo;님의 메시지를 삭제하려면 작성할 때 입력한 비밀번호를 입력하세요.</p>
				<input
					type="password"
					aria-label="삭제 비밀번호"
					value={password}
					autoFocus
					onChange={(event) => {
						setPassword(event.target.value);
						setError('');
					}}
				/>
				{error && (
					<p className="messages-error" role="alert">
						{error}
					</p>
				)}
				<div className="messages-delete-actions">
					<button type="button" onClick={onClose}>
						취소
					</button>
					<button type="submit" className="danger">
						삭제
					</button>
				</div>
			</form>
		</Modal>
	);
};

export default Messages;
