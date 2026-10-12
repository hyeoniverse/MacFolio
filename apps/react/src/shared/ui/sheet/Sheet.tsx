import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import '@/shared/ui/sheet/Sheet.css';

export interface SheetProps {
	/** 시트 이름 (스크린 리더) */
	label: string;
	/** Esc나 덮개(바깥)를 누르면 부른다 */
	onClose: () => void;
	/**
	 * page: 화면 높이에 가까운 시트, 위에 손잡이 막대 (메일 쓰기·답장)
	 * card: 아래에 떠 있는 카드 (메일 동작)
	 * cover: 덮개 없이 화면 전체를 덮는다 (음악 지금 재생 중)
	 */
	variant?: 'page' | 'card' | 'cover';
	/** 시트에 덧붙일 이름 (안쪽 여백·색은 쓰는 쪽의 CSS) */
	className?: string;
	/** 시트에 넣을 CSS 변수 등 */
	style?: CSSProperties;
	children: ReactNode;
}

/**
 * 아래에서 올라오는 시트의 겉: 덮개, 시트, role·aria-modal·aria-label, 열 때 초점, Esc·덮개 누르기로 닫기,
 * 닫힐 때 덮개의 어두운 바탕은 걷히고 시트는 아래로 내려가며 사라지는 움직임(motion.css의 sheet-out).
 * 휴대폰 화면 전용이다 (데스크톱의 가운데 창은 Modal). 위치 기준은 가장 가까운 앱 화면이다.
 * 덮개 색·층은 쓰는 쪽 CSS가 --ui-sheet-dim·--ui-sheet-z로, 시트 바탕은 --ui-sheet-bg로 정한다
 */
const Sheet = ({ label, onClose, variant = 'page', className, style, children }: SheetProps) => {
	const box = useRef<HTMLDivElement>(null);
	const overlayExit = useExitMotion<HTMLDivElement>('dim-out');
	const coverExit = useExitMotion<HTMLDivElement>('sheet-out');

	useEffect(() => {
		// 안의 입력 칸이 먼저 초점을 가져갔으면(autoFocus) 그대로 둔다
		if (!box.current?.contains(document.activeElement)) box.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	const setBox = (element: HTMLDivElement | null) => {
		box.current = element;
		// 덮개가 없는 cover는 시트 자신이 내려가며 사라진다 (덮개가 있으면 덮개의 복사본 안에서 내려간다)
		return variant === 'cover' ? coverExit(element) : undefined;
	};

	const sheet = (
		<div
			ref={setBox}
			className={['ui-sheet', variant, className].filter(Boolean).join(' ')}
			role="dialog"
			// cover는 닫기 단추가 시트 바깥(떠 있는 뒤로 가기)에 있어 바깥을 가리지 않는다
			aria-modal={variant === 'cover' ? undefined : true}
			aria-label={label}
			tabIndex={-1}
			style={style}
		>
			{variant === 'page' && <span className="ui-sheet-grabber" aria-hidden="true" />}
			{children}
		</div>
	);
	if (variant === 'cover') return sheet;

	return (
		<div
			ref={overlayExit}
			className="ui-sheet-overlay"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			{sheet}
		</div>
	);
};

export default Sheet;
