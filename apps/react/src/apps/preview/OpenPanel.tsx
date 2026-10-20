import React, { useEffect, useMemo, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	Clock,
	FileText,
	Folder,
	FolderOpen,
	LayoutGrid,
	Rows3,
	Search,
	SquarePen,
	type LucideIcon,
} from 'lucide-react';
import SearchField from '@/shared/ui/search-field/SearchField';
import { fileUrl } from '@/apps/finder/documents';
import {
	FAVORITE_IDS,
	find,
	foldersOf,
	mediaKind,
	previewFolder,
	search,
	sidebarIdOf,
	type FileItem,
	type FinderItem,
} from '@/apps/finder/files';
import { useLocations } from '@/apps/finder/useLocations';
import FinderIcon from '@/apps/finder/FinderIcon';
import AppsGlyph from '@/apps/finder/AppsGlyph';
import { loadPdf } from './pdf';
import { PdfThumb } from './PdfView';
import './Preview.css';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

/**
 * 고른 곳. preview: iCloud의 앱 폴더(이 앱이 여는 파일 전부), recents: 최근 항목,
 * 그 밖에는 Finder 트리의 폴더 id (docs, docs:이력서, blog/프론트엔드 …)
 */
type Place = 'preview' | 'recents' | string;

/** 사이드바 즐겨찾기 아이콘 (Finder의 위치와 같은 순서) */
const LOCATION_ICONS: Record<string, LucideIcon | typeof AppsGlyph> = {
	docs: FileText,
	blog: SquarePen,
	apps: AppsGlyph,
};

/** 미리보기가 열 수 있는 것: PDF와 그림 */
const canPreview = (item: FileItem) => item.kind === 'pdf' || item.kind === 'image';

/** 이 열기 창을 띄운 앱. 기본은 미리보기 */
export interface OpenPanelApp {
	name: string;
	icon: string;
	/** 열 수 있는 파일인지 (그 밖의 파일은 흐리게, 고를 수 없다) */
	canOpen: (item: FileItem) => boolean;
}

const PREVIEW_APP: OpenPanelApp = { name: '미리보기', icon: '/imgs/preview.svg', canOpen: canPreview };

/** 올린 파일 전부 (폴더를 따라 내려간다, 같은 파일은 한 번) */
const allFiles = (items: FinderItem[], seen = new Set<string>()): FileItem[] =>
	items.flatMap((item) => {
		if (item.kind === 'folder') return allFiles(item.children, seen);
		if (item.kind !== 'pdf' && item.kind !== 'image' && item.kind !== 'file') return [];
		if (seen.has(item.key)) return [];
		seen.add(item.key);
		return [item];
	});

/** 파일 그림: 그림은 그대로, PDF는 첫 쪽, 그 밖은 Finder 아이콘 */
const ItemThumb: React.FC<{ item: FinderItem }> = ({ item }) => {
	const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
	const pdfKey = item.kind === 'pdf' ? item.key : null;
	useEffect(() => {
		if (!pdfKey) return;
		let alive = true;
		loadPdf(fileUrl(pdfKey)).then(
			(loaded) => alive && setDoc(loaded),
			() => undefined
		);
		return () => {
			alive = false;
		};
	}, [pdfKey]);
	if (item.kind === 'file' && mediaKind(item.name) === 'video')
		// 첫 장면 (Finder처럼 0.5초 뒤. 처음이 검은 화면인 영상이 많다)
		return (
			<video className="preview-open-paper" src={`${fileUrl(item.key)}#t=0.5`} preload="metadata" muted playsInline />
		);
	if (item.kind === 'image')
		return <img className="preview-open-paper" src={fileUrl(item.key)} alt="" draggable={false} />;
	if (item.kind === 'pdf')
		return doc ? (
			<PdfThumb doc={doc} number={1} width={64} />
		) : (
			<span className="preview-open-blank" aria-hidden="true" />
		);
	return <FinderIcon item={item} />;
};

/**
 * 파일 없이 미리보기를 열면 뜨는 '열기' 창 (macOS 미리보기가 처음 뜰 때처럼).
 * Finder와 같은 파일 트리를 둘러본다: 왼쪽은 미리보기(iCloud)·최근 항목과 즐겨찾기(문서·프로젝트·블로그·응용 프로그램),
 * 폴더는 두 번 눌러 들어가고 뒤로·앞으로로 오간다. 미리보기가 열 수 없는 파일(문서·글·앱)은 흐리게 보이고 고를 수 없다
 */
const OpenPanel: React.FC<{ onOpen: (file: FileItem) => void; onCancel: () => void; app?: OpenPanelApp }> = ({
	onOpen,
	onCancel,
	app = PREVIEW_APP,
}) => {
	const locations = useLocations();
	const isFile = (item: FinderItem): item is FileItem =>
		(item.kind === 'pdf' || item.kind === 'image' || item.kind === 'file') && app.canOpen(item);
	const [history, setHistory] = useState<{ places: Place[]; at: number }>({ places: ['preview'], at: 0 });
	const place = history.places[history.at];
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<string | null>(null);

	const go = (next: Place) => {
		setHistory(({ places, at }) => ({ places: [...places.slice(0, at + 1), next], at: at + 1 }));
		setSelected(null);
		setQuery('');
	};
	const step = (delta: number) => {
		setHistory((current) => ({ ...current, at: Math.min(current.places.length - 1, Math.max(0, current.at + delta)) }));
		setSelected(null);
	};

	const files = useMemo(
		() =>
			app === PREVIEW_APP
				? (previewFolder(locations).children as FileItem[])
				: allFiles(locations).filter((item) => app.canOpen(item)),
		[locations, app]
	);
	const folder = place === 'preview' || place === 'recents' ? null : find(locations, place);
	const q = query.trim();
	const shown: FinderItem[] = q
		? search(locations, q)
		: place === 'preview'
			? files
			: place === 'recents'
				? [...files].sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''))
				: folder?.kind === 'folder'
					? folder.children
					: [];
	const chosen = shown.find((item) => item.id === selected) ?? null;
	const title = place === 'preview' ? app.name : place === 'recents' ? '최근 항목' : (folder?.name ?? '');
	// 위치 칸: 미리보기 폴더는 macOS처럼 'iCloud'에 있다
	const location = place === 'preview' ? 'iCloud' : title;
	// 사이드바에서 칠할 곳: 폴더 안에 들어가 있으면 그 폴더가 든 즐겨찾기
	const root =
		place === 'preview' || place === 'recents' ? place : (sidebarIdOf(locations, place, FAVORITE_IDS) ?? place);

	const open = (item: FinderItem) => {
		if (item.kind === 'folder') go(item.id);
		// 바탕화면의 가상본은 Finder처럼 원래 폴더로 간다
		else if (item.kind === 'alias') go(item.target);
		else if (isFile(item)) onOpen(item);
	};

	const placeButton = (target: Place, Icon: LucideIcon | typeof AppsGlyph, label: string) => (
		<button
			key={target}
			type="button"
			className={`preview-open-place${root === target ? ' active' : ''}`}
			aria-current={root === target ? 'true' : undefined}
			onClick={() => go(target)}
		>
			<Icon size={18} strokeWidth={1.5} aria-hidden="true" />
			{label}
		</button>
	);

	return (
		<div className="preview-open" role="dialog" aria-label="열기">
			<nav className="preview-open-sidebar" aria-label="위치">
				{placeButton('preview', root === 'preview' ? FolderOpen : Folder, app.name)}
				{placeButton('recents', Clock, '최근 항목')}
				<p className="preview-open-heading">즐겨찾기</p>
				{foldersOf(locations, FAVORITE_IDS).map((item) =>
					placeButton(item.id, LOCATION_ICONS[item.id] ?? Folder, item.name)
				)}
			</nav>
			<div className="preview-open-main">
				{/* macOS 열기 창의 위 막대: 뒤로·앞으로, 보기, 위치, 찾기 */}
				<div className="preview-open-bar">
					<span className="preview-open-capsule">
						<button type="button" aria-label="뒤로" disabled={history.at === 0} onClick={() => step(-1)}>
							<ChevronLeft size={18} strokeWidth={1.6} aria-hidden="true" />
						</button>
						<button
							type="button"
							aria-label="앞으로"
							disabled={history.at === history.places.length - 1}
							onClick={() => step(1)}
						>
							<ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
						</button>
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
						<img src={app.icon} alt="" />
						<span>
							{app.name} — {location}
						</span>
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
					<div className="preview-open-grid" role="listbox" aria-label={q ? '찾은 항목' : title}>
						{shown.map((item) => {
							// 폴더와 이 앱이 여는 파일만 고를 수 있다 (macOS 열기 창처럼 나머지는 흐리게)
							const usable = item.kind === 'folder' || item.kind === 'alias' || isFile(item);
							return (
								<button
									key={item.id}
									type="button"
									role="option"
									aria-selected={item.id === selected}
									aria-disabled={!usable || undefined}
									className={`preview-open-file${item.id === selected ? ' selected' : ''}${usable ? '' : ' unusable'}`}
									onClick={() => usable && setSelected(item.id)}
									onDoubleClick={() => open(item)}
								>
									<span className="preview-open-thumb">
										<ItemThumb item={item} />
									</span>
									<span className="preview-open-name">{item.name}</span>
								</button>
							);
						})}
					</div>
				) : (
					<EmptyState className="preview-open-empty">
						{q
							? '찾는 이름이 없습니다.'
							: folder?.kind === 'folder'
								? (folder.emptyNote ?? '비어 있음')
								: '파일이 없습니다.'}
					</EmptyState>
				)}
				<div className="preview-open-actions">
					<button type="button" className="ui-button" onClick={onCancel}>
						취소
					</button>
					<button type="button" className="ui-button primary" disabled={!chosen} onClick={() => chosen && open(chosen)}>
						열기
					</button>
				</div>
			</div>
		</div>
	);
};

export default OpenPanel;
