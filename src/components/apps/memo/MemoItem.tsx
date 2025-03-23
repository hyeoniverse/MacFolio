import React from 'react';
import { MemoItemProps } from '../../../types/MemoTypes';

const MemoItem: React.FC<MemoItemProps> = ({ memo, isActive, setSelectedMemo, folders }) => {
	const folderName = folders.find((folder) => folder.id === memo.folder_id)?.title || 'Unknown Folder';
	return (
		<div className={`memo-item ${isActive ? 'active' : ''}`} onClick={() => setSelectedMemo(memo)}>
			<h3 className="memo-title">{memo.title}</h3>
			<p className="memo-date">{memo.date}</p>
			<p className="memo-content">{memo.content}</p>
			<p className="memo-content">
				<i className="fa-solid fa-folder"></i>
				{folderName}
			</p>
		</div>
	);
};

export default MemoItem;
