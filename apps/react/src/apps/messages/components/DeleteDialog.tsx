import React, { useState } from 'react';
import Modal from '@/shared/ui/Modal';
import type { DeleteResult } from '../repository';

interface Props {
	onClose: () => void;
	onDelete: (password: string) => Promise<DeleteResult>;
}

const DeleteDialog: React.FC<Props> = ({ onClose, onDelete }) => {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');

	const confirm = async (event: React.FormEvent) => {
		event.preventDefault();
		const result = await onDelete(password);
		if (result === 'deleted') onClose();
		else setError(result === 'wrong-password' ? '비밀번호가 일치하지 않습니다.' : '이미 삭제된 메시지입니다.');
	};

	return (
		<Modal title="메시지 삭제" onClose={onClose}>
			<form className="messages-delete-form" onSubmit={confirm}>
				<p>대화를 시작할 때 정한 비밀번호를 입력하세요. 삭제한 메시지는 되돌릴 수 없습니다.</p>
				<input
					type="password"
					aria-label="삭제 비밀번호"
					value={password}
					autoFocus
					onChange={(event) => {
						setPassword(event.target.value);
						setError('');
					}}
				/>
				{error && (
					<p className="messages-error" role="alert">
						{error}
					</p>
				)}
				<div className="messages-delete-actions">
					<button type="button" onClick={onClose}>
						취소
					</button>
					<button type="submit" className="destructive">
						삭제
					</button>
				</div>
			</form>
		</Modal>
	);
};

export default DeleteDialog;
