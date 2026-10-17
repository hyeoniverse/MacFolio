import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import '@/shared/ui/dialog/Modal.css';

export interface ModalProps {
	/** 창 이름 (스크린 리더) */
	label: string;
	/** Esc나 덮개(바깥)를 누르면 부른다 */
	onClose: () => void;
	/** alertdialog: 답을 받아야 닫히는 경고창 (AlertDialog, 로그인 결과) */
	role?: 'dialog' | 'alertdialog';
	/** window: 가장 가까운 위치 기준(앱 창)을 덮는다 / screen: 화면 전체를 덮고 body에 그린다 */
	scope?: 'window' | 'screen';
	/** 열자마자 초점을 둘 요소 (확인 버튼, 입력 칸). 없으면 상자 자신 */
	initialFocus?: RefObject<HTMLElement | null>;
	/** 덮개에 덧붙일 이름. 어둡기와 층은 앱 CSS가 --ui-modal-dim·--ui-modal-z로 정한다 */
	overlayClassName?: string;
	/** 상자에 덧붙일 이름 (모양은 쓰는 쪽의 CSS) */
	className?: string;
	children: ReactNode;
}

/**
 * 가운데 뜨는 창의 겉: 덮개, 상자, role·aria-modal·aria-label, 열 때 초점, Esc·바깥 누르기로 닫기,
 * 닫힐 때 덮개는 흐려지고 상자는 작아지며 사라지는 움직임(motion.css). 안에 무엇을 그리는지는 쓰는 쪽이 정한다.
 */
const Modal = ({
	label,
	onClose,
	role = 'dialog',
	scope = 'window',
	initialFocus,
	overlayClassName,
	className,
	children,
}: ModalProps) => {
	const box = useRef<HTMLDivElement>(null);
	const overlay = useExitMotion<HTMLDivElement>('fade-out');

	useEffect(() => {
		(initialFocus?.current ?? box.current)?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
		// 초점은 열 때 한 번만
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onClose]);

	const node = (
		<div
			ref={overlay}
			className={['ui-modal-overlay', scope, overlayClassName].filter(Boolean).join(' ')}
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={box}
				className={['ui-modal', className].filter(Boolean).join(' ')}
				role={role}
				aria-modal="true"
				aria-label={label}
				tabIndex={-1}
			>
				{children}
			</div>
		</div>
	);
	return scope === 'screen' ? createPortal(node, document.body) : node;
};

export default Modal;
