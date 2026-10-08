import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useEffect, useRef } from 'react';
import '@/desktop/dock/DockItem.css';

interface DockItemProps {
	/** 앱 이름. 접근성 이름과 이미지 대체 텍스트로 쓴다. */
	label: string;
	icon: string;
	isActive: boolean;
	isHidden: boolean;
	disableRadius?: boolean;
	onClick: () => void;
}

const DockItem: React.FC<DockItemProps> = ({ label, icon, isActive, isHidden, onClick, disableRadius = false }) => {
	const iconRef = useRef<HTMLImageElement>(null);
	const wasActive = useRef(isActive);
	const indicator = useExitMotion<HTMLDivElement>('fade-out');

	// 앱이 실행되면 macOS처럼 아이콘이 두 번 튄다 (처음부터 실행 중인 앱은 튀지 않는다)
	useEffect(() => {
		if (isActive && !wasActive.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			iconRef.current?.animate(
				[
					{ transform: 'translateY(0)' },
					{ transform: 'translateY(-38%)', offset: 0.25 },
					{ transform: 'translateY(0)', offset: 0.5 },
					{ transform: 'translateY(-20%)', offset: 0.72 },
					{ transform: 'translateY(0)' },
				],
				{ duration: 700, easing: 'ease-in-out' }
			);
		}
		wasActive.current = isActive;
	}, [isActive]);

	if (isHidden) return null;

	return (
		<div className="dock-item" role="button" aria-label={label} title={label} onClick={onClick}>
			<img ref={iconRef} src={icon} alt={label} style={{ borderRadius: disableRadius ? '0' : '1rem' }} />
			{/* 켜짐 표시는 앱을 열면 톡 나타나고, 끄면 흐려지며 사라진다 */}
			{isActive && <div ref={indicator} className="active-indicator"></div>}
		</div>
	);
};

export default DockItem;
