import React, { useEffect } from 'react';
import '@/shared/ui/Modal.css';

interface ModalProps {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}

/** 바깥 영역을 클릭하거나 Esc를 누르면 닫힌다. */
const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);

	return (
		<div
			className="modal-overlay"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="modal-content" role="dialog" aria-modal="true" aria-label={title}>
				<h3>
					<strong>{title}</strong>
				</h3>
				{children}
			</div>
		</div>
	);
};

export default Modal;
