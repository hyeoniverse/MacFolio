import React from 'react';
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
	if (isHidden) return null;

	return (
		<div className="dock-item" role="button" aria-label={label} title={label} onClick={onClick}>
			<img src={icon} alt={label} style={{ borderRadius: disableRadius ? '0' : '1rem' }} />
			{isActive && <div className="active-indicator"></div>}
		</div>
	);
};

export default DockItem;
