// 폴더 아이콘과 이름 입력 (새 폴더, 이름 바꾸기). FolderRow와 FolderSidebar가 함께 쓴다
import { cssVars } from '@/shared/lib/cssVars';
import React, { useState } from 'react';
import { FOLDER_NAME_MAX, validateFolderName } from '@macfolio/desktop-core/memo';

/** 폴더 아이콘 (SF Symbols의 folder 모양에 맞춰 선으로) */
export const FolderIcon = () => <i className="fa-regular fa-folder memo-folder-icon" aria-hidden="true" />;

/**
 * 폴더 이름 입력 (새 폴더, 이름 바꾸기). 폴더 줄과 같은 모양이라 들여쓰기가 맞는다.
 * Enter로 정하고 Esc로 그만둔다.
 */
export const FolderNameInput: React.FC<{
	depth: number;
	initial?: string;
	label: string;
	siblings: string[];
	onSubmit: (name: string) => void;
	onCancel: () => void;
}> = ({ depth, initial = '', label, siblings, onSubmit, onCancel }) => {
	const [name, setName] = useState(initial);
	const [error, setError] = useState<string | null>(null);

	const submit = () => {
		if (name.trim() === initial) return onCancel();
		const problem = validateFolderName(name, siblings);
		if (problem) setError(problem);
		else onSubmit(name.trim());
	};

	return (
		<>
			<div className="memo-folder-row" style={cssVars({ depth })}>
				<span className="memo-disclosure" aria-hidden="true" />
				<div className="memo-folder editing">
					<FolderIcon />
					<input
						aria-label={label}
						placeholder="새로운 폴더"
						maxLength={FOLDER_NAME_MAX}
						value={name}
						autoFocus
						onFocus={(event) => event.currentTarget.select()}
						onChange={(event) => {
							setName(event.target.value);
							setError(null);
						}}
						onKeyDown={(event) => {
							if (event.nativeEvent.isComposing) return;
							if (event.key === 'Enter') submit();
							if (event.key === 'Escape') onCancel();
						}}
						onBlur={() => {
							if (!name.trim() || name.trim() === initial) onCancel();
						}}
					/>
				</div>
			</div>
			{error && (
				<p className="memo-folder-error" role="alert" style={cssVars({ depth })}>
					{error}
				</p>
			)}
		</>
	);
};
