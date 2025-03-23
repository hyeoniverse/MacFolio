import React from 'react';
import '../../styles/DockItem.css';

interface DockItemProps {
	icon: string;
	isActive: boolean;
	isHidden: boolean;
	disableRadius?: boolean;
	onClick: () => void;
}

const DockItem: React.FC<DockItemProps> = ({ icon, isActive, isHidden, onClick, disableRadius = false }) => {
	if (isHidden) return null;

	return (
		<div className="dock-item" onClick={onClick}>
			<img src={icon} alt={icon} style={{ borderRadius: disableRadius ? '0' : '1rem' }} />
			{isActive && <div className="active-indicator"></div>}
		</div>
	);
};

export default DockItem;
