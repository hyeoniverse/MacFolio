import React from 'react';
import { FolderListProps } from '../../../types/MemoTypes';

const FolderList: React.FC<FolderListProps> = ({ folders, selectedFolder, setSelectedFolder }) => (
  <div className="folder-list">
    <i className="fa-brands fa-apple"></i>
    <h2>iCloud 메모</h2>
    {folders.length === 0 ? (
      <p>폴더가 없습니다</p>
    ) : (
      folders.map(folder => (
        <div key={folder.id} className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`} onClick={() => setSelectedFolder(folder.id)}>
          {folder.title}
        </div>
      ))
    )}
  </div>
);

export default FolderList;
