import React from 'react';
import { Trash2, PenBox } from 'lucide-react';

const MemoTools: React.FC<{ isCreating: boolean, setIsCreating: any, isScrolled: boolean, newMemo: any, setShowPasswordModal: any, setShowErrorModal: any, handleResetMemo: any }> = ({
  isCreating, setIsCreating, isScrolled, newMemo, setShowPasswordModal, setShowErrorModal, handleResetMemo
}) => (
  <div className={`memo-tools ${isScrolled ? 'scrolled' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem' }}>
    {isCreating ? (
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <button onClick={handleResetMemo}>
          <i className="fa-solid fa-delete-left" style={{ fontSize: '1.2rem', color: '#edbb4d' }}></i>
        </button>
        <button onClick={() => {
          if (!newMemo.title || !newMemo.content) {
            setShowErrorModal(true);
          } else {
            setShowPasswordModal(true);
          }
        }} style={{ marginLeft: 'auto' }}>
          <i className="fa-solid fa-check" style={{ fontSize: '1.2rem', color: newMemo.title && newMemo.content ? '#edbb4d' : 'gray' }}></i>
        </button>
      </div>
    ) : (
      <div>
        <button><Trash2 className='icon' /></button>
        <button onClick={() => setIsCreating(true)}>
          <PenBox className='icon' />
        </button>
      </div>
    )}
  </div>
);

export default MemoTools;
