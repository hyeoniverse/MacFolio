import React, { useEffect, useState } from 'react';
import { PROFILE } from '@/shared/profile';
import { LIMITS, validateContact, type ContactErrors, type ContactInput } from '../contact';
import type { SendResult } from '../sender';
import Button from '@/shared/ui/button/Button';

interface Props {
	onSend: (input: ContactInput) => Promise<SendResult>;
	onCancel: () => void;
}

const EMPTY: ContactInput = { name: '', email: '', subject: '', body: '' };

/** macOS 메일의 새로운 메시지: 받는 사람은 사이트 주인으로 고정, 방문자는 이름·회신 주소·제목·내용을 쓴다 */
const ComposeView: React.FC<Props> = ({ onSend, onCancel }) => {
	const [form, setForm] = useState<ContactInput>(EMPTY);
	const [errors, setErrors] = useState<ContactErrors>({});
	const [result, setResult] = useState<SendResult | null>(null);
	const [sending, setSending] = useState(false);

	// Esc로 쓰기를 그만둔다
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCancel();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onCancel]);

	const field = (key: keyof ContactInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setForm((prev) => ({ ...prev, [key]: event.target.value }));
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	};

	const send = async (event: React.FormEvent) => {
		event.preventDefault();
		const { value, errors: found } = validateContact(form);
		setErrors(found);
		if (Object.keys(found).length > 0 || sending) return;
		setSending(true);
		try {
			setResult(await onSend(value));
		} finally {
			setSending(false);
		}
	};

	if (result && result.status !== 'failed') {
		return <SentView handedOff={result.status === 'handed-off'} onDone={onCancel} />;
	}

	return (
		<form className="mail-compose" aria-label="새로운 메시지" onSubmit={send} noValidate>
			<header className="mail-compose-toolbar">
				<strong>새로운 메시지</strong>
				<div>
					<Button onClick={onCancel}>취소</Button>
					<Button tone="primary" type="submit" disabled={sending}>
						<i className="fa-solid fa-paper-plane" aria-hidden="true" /> 보내기
					</Button>
				</div>
			</header>

			<div className="mail-compose-row">
				<span>받는 사람:</span>
				<span className="mail-recipient">
					{PROFILE.name} &lt;{PROFILE.email}&gt;
				</span>
			</div>
			<Row label="이름:" error={errors.name}>
				<input aria-label="이름" maxLength={LIMITS.name} value={form.name} onChange={field('name')} autoFocus />
			</Row>
			<Row label="회신 주소:" error={errors.email}>
				<input
					aria-label="회신 주소"
					type="email"
					placeholder="답장받을 이메일"
					value={form.email}
					onChange={field('email')}
				/>
			</Row>
			<Row label="제목:" error={errors.subject}>
				<input aria-label="제목" maxLength={LIMITS.subject} value={form.subject} onChange={field('subject')} />
			</Row>
			<textarea
				className="mail-compose-body"
				aria-label="내용"
				aria-invalid={!!errors.body}
				maxLength={LIMITS.body}
				placeholder="채용 제안, 협업, 피드백 등 편하게 남겨 주세요."
				value={form.body}
				onChange={field('body')}
			/>
			{errors.body && (
				<p className="mail-error" role="alert">
					{errors.body}
				</p>
			)}
			{result?.status === 'failed' && (
				<p className="mail-error" role="alert">
					{result.message}
				</p>
			)}
		</form>
	);
};

const Row: React.FC<{ label: string; error?: string; children: React.ReactElement }> = ({ label, error, children }) => (
	<label className={`mail-compose-row ${error ? 'invalid' : ''}`}>
		<span>{label}</span>
		{children}
		{error && (
			<span className="mail-error" role="alert">
				{error}
			</span>
		)}
	</label>
);

/** 보낸 뒤: 메일 앱으로 넘긴 경우에는 메일 앱에서 보내기를 눌러야 한다고 안내한다 */
const SentView: React.FC<{ handedOff: boolean; onDone: () => void }> = ({ handedOff, onDone }) => {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(PROFILE.email);
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
						<Button onClick={copy}>{copied ? '복사했어요' : `${PROFILE.email} 복사`}</Button>
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
