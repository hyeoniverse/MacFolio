import { useEffect, useRef } from 'react';
import Button from '@/shared/ui/button/Button';
import '@/shared/ui/dialog/AlertDialog.css';

export interface AlertDialogProps {
	/** 굵은 첫 줄 (예: '1개의 메모를 영구적으로 삭제하겠습니까?') */
	title: string;
	/** 그 아래 설명 (예: '이 동작은 취소할 수 없습니다.') */
	message?: string;
	/** 확인 단추 글자 (예: '삭제') */
	confirmLabel: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * macOS 경고창 (앱 안). 화면 전체가 아니라 가장 가까운 위치 기준(앱 창) 한가운데에 뜬다.
 * Esc·바깥 누르기는 취소, Enter는 확인 (확인 단추에 초점이 있다).
 */
const AlertDialog = ({ title, message, confirmLabel, cancelLabel = '취소', onConfirm, onCancel }: AlertDialogProps) => {
	const confirmButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		confirmButton.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onCancel();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onCancel]);

	return (
		<div
			className="ui-alert-overlay"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<div className="ui-alert" role="alertdialog" aria-modal="true" aria-label={title}>
				<h3>{title}</h3>
				{message && <p>{message}</p>}
				<div className="ui-alert-actions">
					<Button onClick={onCancel}>{cancelLabel}</Button>
					<Button ref={confirmButton} tone="primary" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default AlertDialog;
