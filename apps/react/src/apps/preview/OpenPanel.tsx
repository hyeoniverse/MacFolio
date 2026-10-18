import React, { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	Clock,
	Folder,
	FolderOpen,
	LayoutGrid,
	Rows3,
	Search,
	type LucideIcon,
} from 'lucide-react';
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

/** preview: 미리보기 폴더(iCloud, 모든 문서), recents: 최근 항목, 그리고 문서 폴더 */
type Place = 'preview' | 'recents' | DocumentFolder;

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
		<span className="preview-open-blank" aria-hidden="true" />
	);
};

/**
 * 파일 없이 미리보기를 열면 뜨는 '열기' 창 (macOS 미리보기가 처음 뜰 때처럼).
 * 왼쪽은 미리보기 폴더(처음 고른 곳, 모든 문서)·최근 항목과 문서 폴더(이력서·포트폴리오·자격증), 가운데는 파일 그림. 두 번 누르거나 열기로 연다
 */
const OpenPanel: React.FC<{ onOpen: (entry: DocumentEntry) => void; onCancel: () => void }> = ({
	onOpen,
	onCancel,
}) => {
	const entries = useDocumentEntries();
	useEffect(() => {
		void loadDocuments();
	}, []);
	const [place, setPlace] = useState<Place>('preview');
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<string | null>(null);

	const q = query.trim().toLocaleLowerCase();
	const shown = entries
		.filter((entry) => place === 'preview' || place === 'recents' || entry.folder === place)
		.filter((entry) => !q || entry.name.toLocaleLowerCase().includes(q))
		.sort((a, b) =>
			place === 'recents' ? (b.updated ?? '').localeCompare(a.updated ?? '') : a.name.localeCompare(b.name, 'ko')
		);
	const chosen = shown.find((entry) => entry.key === selected) ?? null;
	const title = place === 'preview' ? '미리보기' : place === 'recents' ? '최근 항목' : place;
	// 위치 칸: macOS처럼 미리보기 폴더는 'iCloud'에 있다
	const location = place === 'preview' ? 'iCloud' : title;

	const placeButton = (target: Place, Icon: LucideIcon, label: string) => (
		<button
			type="button"
			className={`preview-open-place${place === target ? ' active' : ''}`}
			aria-current={place === target ? 'true' : undefined}
			onClick={() => {
				setPlace(target);
				setSelected(null);
			}}
		>
			<Icon size={18} strokeWidth={1.5} aria-hidden="true" />
			{label}
		</button>
	);

	return (
		<div className="preview-open" role="dialog" aria-label="열기">
			<nav className="preview-open-sidebar" aria-label="위치">
				{placeButton('preview', place === 'preview' ? FolderOpen : Folder, '미리보기')}
				{placeButton('recents', Clock, '최근 항목')}
				<p className="preview-open-heading">즐겨찾기</p>
				{DOCUMENT_FOLDERS.map((folder) => (
					<React.Fragment key={folder}>
						{placeButton(folder, place === folder ? FolderOpen : Folder, folder)}
					</React.Fragment>
				))}
			</nav>
			<div className="preview-open-main">
				{/* macOS 열기 창의 위 막대: 뒤로·앞으로, 보기, 위치, 찾기 (보기·이동은 모양만) */}
				<div className="preview-open-bar">
					<span className="preview-open-capsule" aria-hidden="true">
						<ChevronLeft size={18} strokeWidth={1.6} />
						<ChevronRight size={18} strokeWidth={1.6} />
					</span>
					<span className="preview-open-capsule" aria-hidden="true">
						<LayoutGrid size={16} strokeWidth={1.5} />
						<ChevronDown size={12} strokeWidth={2} />
					</span>
					<span className="preview-open-capsule wide-only" aria-hidden="true">
						<Rows3 size={16} strokeWidth={1.5} />
						<ChevronDown size={12} strokeWidth={2} />
					</span>
					<span className="preview-open-title">
						<img src="/imgs/preview.svg" alt="" />
						<span>미리보기 — {location}</span>
						<ChevronsUpDown size={14} strokeWidth={1.8} aria-hidden="true" />
					</span>
					<SearchField
						label="파일 이름 찾기"
						placeholder="검색"
						className="preview-open-search"
						icon={<Search size={15} strokeWidth={1.6} aria-hidden="true" />}
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
						{q
							? '찾는 이름이 없습니다.'
							: place === 'preview' || place === 'recents'
								? '파일이 없습니다.'
								: FOLDER_NOTES[place]}
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
