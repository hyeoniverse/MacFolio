import { useRef } from 'react';
import Button from '@/shared/ui/button/Button';
import Modal from '@/shared/ui/dialog/Modal';
import '@/shared/ui/dialog/AlertDialog.css';

export interface AlertDialogProps {
	/** window: 앱 창 한가운데(기본) / screen: 화면 한가운데, 모든 창 위 (바탕화면처럼 창이 없는 곳에서 띄울 때) */
	scope?: 'window' | 'screen';
	/** 굵은 첫 줄 (예: '1개의 메모를 영구적으로 삭제하겠습니까?') */
	title: string;
	/** 그 아래 설명 (예: '이 동작은 취소할 수 없습니다.') */
	message?: string;
	/** 확인 버튼 글자 (예: '삭제') */
	confirmLabel: string;
	/** 취소 버튼 글자. null이면 확인 버튼 하나만 둔다 (알리기만 하는 경고창). Esc·바깥 누르기는 그래도 onCancel */
	cancelLabel?: string | null;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * macOS 경고창 (앱 안). 화면 전체가 아니라 가장 가까운 위치 기준(앱 창) 한가운데에 뜬다 (Modal의 window).
 * Esc·바깥 누르기는 취소, Enter는 확인 (확인 버튼에 초점이 있다).
 */
const AlertDialog = ({
	title,
	message,
	confirmLabel,
	cancelLabel = '취소',
	onConfirm,
	onCancel,
	scope = 'window',
}: AlertDialogProps) => {
	const confirmButton = useRef<HTMLButtonElement>(null);
	return (
		<Modal
			label={title}
			role="alertdialog"
			scope={scope}
			onClose={onCancel}
			initialFocus={confirmButton}
			overlayClassName="ui-alert-overlay"
			className="ui-alert"
		>
			<h3>{title}</h3>
			{message && <p>{message}</p>}
			<div className="ui-alert-actions">
				{cancelLabel !== null && <Button onClick={onCancel}>{cancelLabel}</Button>}
				<Button ref={confirmButton} tone="primary" onClick={onConfirm}>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
};

export default AlertDialog;
