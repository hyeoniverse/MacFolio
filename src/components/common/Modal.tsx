import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3><strong>{title}</strong></h3>
        {children}
      </div>
    </div>
  );
};

export default Modal;