import React, { useRef, useState } from 'react';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { LIMITS } from '../conversations';

export interface SendResult {
	sent: boolean;
	error?: string;
}

interface Props {
	/** 보내기. 보내지 못했으면 sent: false와 (있다면) 이유를 돌려준다 */
	onSend: (text: string) => Promise<SendResult>;
	/** 입력창 위에 붙는 한 줄 (이 브라우저의 이름) */
	children?: React.ReactNode;
	autoFocus?: boolean;
	placeholder?: string;
}

/**
 * macOS 메시지 앱의 떠 있는 알약 입력창. Enter로 보내고 Shift+Enter로 줄을 바꾼다.
 * 보내지 못하면 입력창 아래 줄 대신 경고창으로 알린다 (에러 줄이 생기며 화면이 밀리지 않게). 쓴 글은 그대로 남는다.
 */
const Composer: React.FC<Props> = ({ onSend, children, autoFocus, placeholder = '메시지' }) => {
	const [text, setText] = useState('');
	const [error, setError] = useState<string>();
	const [sending, setSending] = useState(false);
	const textarea = useRef<HTMLTextAreaElement>(null);

	const submit = async (event?: React.FormEvent) => {
		event?.preventDefault();
		// 빈 글은 보내기 단추도 없으므로 Enter도 무시한다
		if (sending || !text.trim()) return;
		setSending(true);
		try {
			const result = await onSend(text);
			setError(result.error);
			if (result.sent) setText('');
		} finally {
			setSending(false);
		}
	};

	const closeError = () => {
		setError(undefined);
		textarea.current?.focus();
	};
	const canSend = text.trim().length > 0 && !sending;

	return (
		<form className="messages-composer" onSubmit={submit}>
			{children}
			<div className="messages-field">
				<textarea
					ref={textarea}
					aria-label="메시지"
					placeholder={placeholder}
					rows={1}
					maxLength={LIMITS.text.max}
					value={text}
					autoFocus={autoFocus}
					onChange={(event) => setText(event.target.value)}
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
			{error && (
				<AlertDialog
					title="메시지를 보내지 못했습니다"
					message={error}
					confirmLabel="확인"
					cancelLabel={null}
					onConfirm={closeError}
					onCancel={closeError}
				/>
			)}
		</form>
	);
};

export default Composer;
