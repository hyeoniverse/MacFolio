import React, { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import SearchField from '@/shared/ui/search-field/SearchField';
import {
	DOCUMENT_FOLDERS,
	fileUrl,
	loadDocuments,
	useDocumentEntries,
	type DocumentEntry,
	type DocumentFolder,
} from '@/apps/finder/documents';
import { loadPdf } from './pdf';
import { PdfThumb } from './PdfView';

type Place = 'recents' | DocumentFolder;

const FOLDER_NOTES: Record<DocumentFolder, string> = {
	이력서: '공개용 이력서를 준비하고 있습니다.',
	포트폴리오: '포트폴리오 파일을 준비하고 있습니다.',
	자격증: '자격증 사본을 준비하고 있습니다.',
};

/** 파일 그림: 그림은 그대로, PDF는 첫 쪽 */
const FileThumb: React.FC<{ entry: DocumentEntry }> = ({ entry }) => {
	const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
	useEffect(() => {
		if (entry.kind !== 'pdf') return;
		let alive = true;
		loadPdf(fileUrl(entry.key)).then(
			(loaded) => alive && setDoc(loaded),
			() => undefined
		);
		return () => {
			alive = false;
		};
	}, [entry.key, entry.kind]);
	if (entry.kind === 'image') return <img src={fileUrl(entry.key)} alt="" draggable={false} />;
	return doc ? (
		<PdfThumb doc={doc} number={1} width={64} />
	) : (
		<i className="fa-solid fa-file-pdf preview-open-icon" aria-hidden="true" />
	);
};

/**
 * 파일 없이 미리보기를 열면 뜨는 '열기' 창 (macOS 미리보기가 처음 뜰 때처럼).
 * 왼쪽은 최근 항목과 문서 폴더(이력서·포트폴리오·자격증), 가운데는 파일 그림. 두 번 누르거나 열기로 연다
 */
const OpenPanel: React.FC<{ onOpen: (entry: DocumentEntry) => void; onCancel: () => void }> = ({
	onOpen,
	onCancel,
}) => {
	const entries = useDocumentEntries();
	useEffect(() => {
		void loadDocuments();
	}, []);
	const [place, setPlace] = useState<Place>('recents');
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<string | null>(null);

	const q = query.trim().toLocaleLowerCase();
	const shown = entries
		.filter((entry) => place === 'recents' || entry.folder === place)
		.filter((entry) => !q || entry.name.toLocaleLowerCase().includes(q))
		.sort((a, b) =>
			place === 'recents' ? (b.updated ?? '').localeCompare(a.updated ?? '') : a.name.localeCompare(b.name, 'ko')
		);
	const chosen = shown.find((entry) => entry.key === selected) ?? null;
	const title = place === 'recents' ? '최근 항목' : place;

	const placeButton = (target: Place, icon: string, label: string) => (
		<button
			type="button"
			className={`preview-open-place${place === target ? ' active' : ''}`}
			aria-current={place === target ? 'true' : undefined}
			onClick={() => {
				setPlace(target);
				setSelected(null);
			}}
		>
			<i className={icon} aria-hidden="true" />
			{label}
		</button>
	);

	return (
		<div className="preview-open" role="dialog" aria-label="열기">
			<nav className="preview-open-sidebar" aria-label="위치">
				{placeButton('recents', 'fa-regular fa-clock', '최근 항목')}
				<p className="preview-open-heading">문서</p>
				{DOCUMENT_FOLDERS.map((folder) => (
					<React.Fragment key={folder}>{placeButton(folder, 'fa-regular fa-folder', folder)}</React.Fragment>
				))}
			</nav>
			<div className="preview-open-main">
				<div className="preview-open-bar">
					<span className="preview-open-title">
						<i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
						미리보기 — {title}
					</span>
					<SearchField
						label="파일 이름 찾기"
						placeholder="검색"
						className="preview-search-field"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
				{shown.length > 0 ? (
					<div className="preview-open-grid" role="listbox" aria-label={title}>
						{shown.map((entry) => (
							<button
								key={entry.key}
								type="button"
								role="option"
								aria-selected={entry.key === selected}
								className={`preview-open-file${entry.key === selected ? ' selected' : ''}`}
								onClick={() => setSelected(entry.key)}
								onDoubleClick={() => onOpen(entry)}
							>
								<span className="preview-open-thumb">
									<FileThumb entry={entry} />
								</span>
								<span className="preview-open-name">{entry.name}</span>
							</button>
						))}
					</div>
				) : (
					<p className="preview-open-empty">
						{q ? '찾는 이름이 없습니다.' : place === 'recents' ? '파일이 없습니다.' : FOLDER_NOTES[place]}
					</p>
				)}
				<div className="preview-open-actions">
					<button type="button" className="ui-button" onClick={onCancel}>
						취소
					</button>
					<button
						type="button"
						className="ui-button primary"
						disabled={!chosen}
						onClick={() => chosen && onOpen(chosen)}
					>
						열기
					</button>
				</div>
			</div>
		</div>
	);
};

export default OpenPanel;
