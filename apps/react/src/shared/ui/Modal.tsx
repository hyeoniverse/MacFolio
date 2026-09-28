import React from 'react';

interface ModalProps {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}

// TODO(#15): onClose를 받지만 아직 쓰지 않는다. 바깥 영역 클릭·Esc로 닫기 구현 필요
const Modal: React.FC<ModalProps> = ({ title, children }) => {
	return (
		<div className="modal-overlay">
			<div className="modal-content">
				<h3>
					<strong>{title}</strong>
				</h3>
				{children}
			</div>
		</div>
	);
};

export default Modal;
