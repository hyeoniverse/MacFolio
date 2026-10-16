import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import CopyAddress from './CopyAddress';
import React, { useEffect, useState } from 'react';
import { useProfile } from '@/shared/site/profileStore';
import { LIMITS, validateContact, type ContactInput } from '../contact';
import { fetchContactStatus, type ContactStatus, type SendOptions, type SendResult } from '../sender';
import { env } from '@/shared/config/env';
import Turnstile from '@/shared/ui/turnstile/Turnstile';
import Button from '@/shared/ui/button/Button';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';

interface Props {
	onSend: (input: ContactInput, options?: SendOptions) => Promise<SendResult>;
	onCancel: () => void;
	/** 휴대폰: iOS 메일처럼 아래에서 올라온 시트 (왼쪽 위 ×, 오른쪽 위 ↑ 보내기, 큰 제목) */
	sheet?: boolean;
	/** 처음 제목 (답장이면 'Re: …') */
	initialSubject?: string;
}

const EMPTY: ContactInput = { name: '', email: '', subject: '', body: '' };

/** macOS 메일의 새로운 메시지: 받는 사람은 사이트 주인으로 고정, 방문자는 이름·회신 주소·제목·내용을 쓴다 */
const ComposeView: React.FC<Props> = ({ onSend, onCancel, sheet = false, initialSubject = '' }) => {
	const [form, setForm] = useState<ContactInput>({ ...EMPTY, subject: initialSubject });
	// 형식이 어긋났거나 보내지 못했을 때 띄우는 경고창의 문구
	const [warning, setWarning] = useState<string | null>(null);
	const [result, setResult] = useState<SendResult | null>(null);
	const [sending, setSending] = useState(false);
	// 서버가 보낼 수 있는지, 사람 확인(Turnstile)을 켰는지 (#25). 서버가 없으면 묻지 않는다 (메일 앱으로 보낸다)
	const [contact, setContact] = useState<ContactStatus | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [widget, setWidget] = useState(0);
	useEffect(() => {
		if (!env.apiUrl) return;
		let alive = true;
		void fetchContactStatus(env.apiUrl).then((status) => alive && setContact(status));
		return () => {
			alive = false;
		};
	}, []);
	const siteKey = contact?.turnstileSiteKey ?? null;

	// Esc로 쓰기를 그만둔다
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// 경고창이 떠 있으면 Esc는 경고창만 닫는다
			if (event.key !== 'Escape' || warning) return;
			event.preventDefault();
			onCancel();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onCancel, warning]);

	// 넓은 창: 보내거나 취소하면 살짝 내려가며 사라진다 (휴대폰 시트는 MailMobile이 내린다)
	const composeExit = useExitMotion<HTMLFormElement>('sink-out');

	const field = (key: keyof ContactInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setForm((prev) => ({ ...prev, [key]: event.target.value }));
	};

	// 네 칸이 모두 차야 보내기를 누를 수 있다 (빈 칸은 따로 알리지 않는다)
	const filled = Object.values(form).every((value) => value.trim());

	const send = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!filled || sending) return;
		// 형식·길이가 어긋나면 macOS 메일처럼 경고창으로 알린다
		const { value, errors } = validateContact(form);
		const problem = Object.values(errors)[0];
		if (problem) {
			setWarning(problem);
			return;
		}
		if (siteKey && !token) {
			setWarning('사람인지 확인하는 칸이 끝날 때까지 기다려 주세요.');
			return;
		}
		setSending(true);
		try {
			const sent = await onSend(value, { turnstileToken: token ?? undefined });
			setResult(sent);
			if (sent.status === 'failed') setWarning(sent.message);
			// 토큰은 한 번만 쓸 수 있다: 실패했으면 새로 받는다
			if (sent.status === 'failed' && siteKey) setWidget((count) => count + 1);
		} finally {
			setSending(false);
		}
	};

	if (result && result.status !== 'failed') {
		return <SentView handedOff={result.status === 'handed-off'} onDone={onCancel} />;
	}

	return (
		<form
			ref={sheet ? undefined : composeExit}
			className={`mail-compose ${sheet ? 'sheet' : ''}`}
			aria-label="새로운 메시지"
			onSubmit={send}
			noValidate
		>
			{sheet ? (
				<>
					{/* iOS 메일: 왼쪽 위 ×, 오른쪽 위 ↑ (다 쓰면 파랗게), 그 아래 큰 제목(쓴 제목, 없으면 새로운 메시지) */}
					<header className="mail-sheet-head">
						<button type="button" className="mail-sheet-circle" aria-label="취소" onClick={onCancel}>
							<i className="fa-solid fa-xmark" aria-hidden="true" />
						</button>
						<button
							type="submit"
							className={`mail-sheet-circle send ${filled ? 'ready' : ''}`}
							aria-label="보내기"
							disabled={!filled || sending}
						>
							<i className="fa-solid fa-arrow-up" aria-hidden="true" />
						</button>
					</header>
					<h2 className="mail-sheet-title">{form.subject.trim() || '새로운 메시지'}</h2>
				</>
			) : (
				<header className="mail-compose-toolbar">
					<strong>새로운 메시지</strong>
					<div>
						<Button onClick={onCancel}>취소</Button>
						<Button tone="primary" type="submit" disabled={!filled || sending}>
							<i className="fa-solid fa-paper-plane" aria-hidden="true" /> 보내기
						</Button>
					</div>
				</header>
			)}

			<div className="mail-compose-row">
				<span>받는 사람:</span>
				{/* 누르면 이메일 주소를 복사한다 */}
				<CopyAddress className="mail-recipient" />
			</div>
			<Row label="이름:">
				<input aria-label="이름" maxLength={LIMITS.name} value={form.name} onChange={field('name')} autoFocus />
			</Row>
			<Row label="회신 주소:">
				<input
					aria-label="회신 주소"
					type="email"
					placeholder="답장받을 이메일"
					value={form.email}
					onChange={field('email')}
				/>
			</Row>
			<Row label="제목:">
				<input aria-label="제목" maxLength={LIMITS.subject} value={form.subject} onChange={field('subject')} />
			</Row>
			<textarea
				className="mail-compose-body"
				aria-label="내용"
				maxLength={LIMITS.body}
				placeholder="채용 제안, 협업, 피드백 등 편하게 남겨 주세요."
				value={form.body}
				onChange={field('body')}
			/>
			{siteKey && <Turnstile className="mail-turnstile" siteKey={siteKey} resetKey={widget} onToken={setToken} />}
			{warning && (
				<AlertDialog
					title="경고"
					message={warning}
					confirmLabel="확인"
					cancelLabel={null}
					onConfirm={() => setWarning(null)}
					onCancel={() => setWarning(null)}
				/>
			)}
		</form>
	);
};

const Row: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => (
	<label className="mail-compose-row">
		<span>{label}</span>
		{children}
	</label>
);

/** 보낸 뒤: 메일 앱으로 넘긴 경우에는 메일 앱에서 보내기를 눌러야 한다고 안내한다 */
const SentView: React.FC<{ handedOff: boolean; onDone: () => void }> = ({ handedOff, onDone }) => {
	const [copied, setCopied] = useState(false);
	const { email } = useProfile();

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(email);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<section className="mail-sent" aria-label="보내기 결과">
			<i className="fa-regular fa-paper-plane" aria-hidden="true" />
			{handedOff ? (
				<>
					<h2>메일 앱에서 보내기를 눌러 주세요</h2>
					<p>작성한 내용을 담아 메일 앱을 열었어요. 메일 앱이 열리지 않았다면 주소를 복사해서 보내 주세요.</p>
					<div className="mail-sent-actions">
						<Button onClick={copy}>{copied ? '복사했어요' : `${email} 복사`}</Button>
						<Button tone="primary" onClick={onDone}>
							확인
						</Button>
					</div>
				</>
			) : (
				<>
					<h2>메일을 보냈어요</h2>
					<p>확인하고 답장드릴게요. 감사합니다!</p>
					<Button tone="primary" onClick={onDone}>
						확인
					</Button>
				</>
			)}
		</section>
	);
};

export default ComposeView;
