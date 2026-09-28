import React, { useState } from 'react';
import { LIMITS } from '../conversations';

export interface SendResult {
	sent: boolean;
	error?: string;
}

interface Props {
	/** 보내기. 보내지 못했으면 sent: false와 (있다면) 이유를 돌려준다 */
	onSend: (text: string) => Promise<SendResult>;
	/** 입력창 위에 붙는 추가 입력 (새 대화의 이름·비밀번호) */
	children?: React.ReactNode;
	error?: string;
	autoFocus?: boolean;
}

/** macOS 메시지 앱의 떠 있는 알약 입력창. Enter로 보내고 Shift+Enter로 줄을 바꾼다. */
const Composer: React.FC<Props> = ({ onSend, children, error: externalError, autoFocus }) => {
	const [text, setText] = useState('');
	const [error, setError] = useState<string>();
	const [sending, setSending] = useState(false);

	const submit = async (event?: React.FormEvent) => {
		event?.preventDefault();
		if (sending) return;
		setSending(true);
		try {
			const result = await onSend(text);
			setError(result.error);
			if (result.sent) setText('');
		} finally {
			setSending(false);
		}
	};

	const shownError = error ?? externalError;
	const canSend = text.trim().length > 0 && !sending;

	return (
		<form className="messages-composer" onSubmit={submit}>
			{children}
			<div className="messages-field">
				<textarea
					aria-label="메시지"
					placeholder="메시지"
					rows={1}
					maxLength={LIMITS.text.max}
					value={text}
					autoFocus={autoFocus}
					aria-invalid={!!shownError}
					onChange={(event) => {
						setText(event.target.value);
						setError(undefined);
					}}
					onKeyDown={(event) => {
						// 한글 조합 중 Enter는 글자 확정이므로 보내지 않는다
						if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							void submit();
						}
					}}
				/>
				{/* 실제 앱처럼 글을 쓰면 보내기 버튼이 나타난다 */}
				<button type="submit" className="messages-send" aria-label="보내기" disabled={!canSend} hidden={!canSend}>
					<i className="fa-solid fa-arrow-up" aria-hidden="true" />
				</button>
			</div>
			{shownError && (
				<p className="messages-error" role="alert">
					{shownError}
				</p>
			)}
		</form>
	);
};

export default Composer;
