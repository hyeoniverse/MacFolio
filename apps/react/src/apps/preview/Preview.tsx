import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import IconButton from '@/shared/ui/button/IconButton';
import SidebarToggle from '@/shared/ui/button/SidebarToggle';
import SearchField from '@/shared/ui/search-field/SearchField';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import '@/shared/ui/button/Button.css';
import { downloadFile, fileUrl, formatSize, openFileInNewTab } from '@/apps/finder/documents';
import { closeInPreview, selectInPreview, usePreview, type PreviewFile } from './previewStore';
import { countMatches, loadPdf } from './pdf';
import PdfView, { PdfThumb, type PdfViewHandle } from './PdfView';
import ImageView from './ImageView';
import './Preview.css';

/** 배율 단계. 확대·축소는 지금 배율의 다음 단계로 간다 */
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** 사이드바 쪽 그림의 폭 */
const THUMB_WIDTH = 96;

const nextZoom = (scale: number, direction: 1 | -1) =>
	direction > 0
		? (ZOOMS.find((step) => step > scale + 0.001) ?? null)
		: ([...ZOOMS].reverse().find((step) => step < scale - 0.001) ?? null);

/** 열린 PDF 문서들 (사이드바와 본문이 같이 쓴다) */
function usePdfDocuments(files: PreviewFile[]) {
	const [docs, setDocs] = useState<Record<string, PDFDocumentProxy | 'error'>>({});
	useEffect(() => {
		for (const file of files) {
			if (file.kind !== 'pdf' || docs[file.key]) continue;
			loadPdf(fileUrl(file.key)).then(
				(doc) => setDocs((all) => ({ ...all, [file.key]: doc })),
				() => setDocs((all) => ({ ...all, [file.key]: 'error' }))
			);
		}
	}, [files, docs]);
	return docs;
}

/**
 * 미리보기 (macOS 미리보기). Finder의 문서 파일(PDF·그림)을 연다. 파일은 R2에 있고 사이트와 같은 주소(/files/<key>)로 온다.
 * - PDF는 pdf.js로 쪽을 직접 그린다: 쪽이 세로로 이어지고, 글자를 고르고 복사하고 찾을 수 있다
 * - 위 막대: 사이드바, 이름과 쪽, 축소·확대, 찾기, 다운로드·새 창. 메뉴 막대의 보기·이동에도 같은 일이 있다
 * - 왼쪽 사이드바: 쪽 그림 (파일을 여럿 열면 파일마다 묶는다)
 */
const Preview: React.FC = () => {
	const { files, current } = usePreview();
	const file = files.find((open) => open.key === current) ?? null;
	const docs = usePdfDocuments(files);
	const doc =
		file && file.kind === 'pdf' && typeof docs[file.key] === 'object' ? (docs[file.key] as PDFDocumentProxy) : null;

	// 파일마다 배율을 기억한다 (null이면 맞춤)
	const [zooms, setZooms] = useState<Record<string, number | null>>({});
	const zoom = file ? (zooms[file.key] ?? null) : null;
	const [scale, setScale] = useState(1);
	const setZoom = (next: number | null) => file && setZooms((all) => ({ ...all, [file.key]: next }));
	const step = (direction: 1 | -1) => {
		const next = nextZoom(scale, direction);
		if (next !== null) setZoom(next);
	};

	// 파일마다 돌린 각도 (도구 막대의 회전, 왼쪽으로 90도씩)
	const [rotations, setRotations] = useState<Record<string, number>>({});
	const rotation = file ? (rotations[file.key] ?? 0) : 0;
	const rotate = (by: 90 | -90) =>
		file && setRotations((all) => ({ ...all, [file.key]: ((all[file.key] ?? 0) + by + 360) % 360 }));

	// 도구 막대의 정보(ⓘ)·공유 메뉴
	const [popup, setPopup] = useState<{ kind: 'info' | 'share'; x: number; y: number } | null>(null);
	const openPopup = (kind: 'info' | 'share') => (event: React.MouseEvent<HTMLButtonElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		setPopup(popup?.kind === kind ? null : { kind, x: rect.left, y: rect.bottom + 6 });
	};

	const [page, setPage] = useState(1);
	const pages = doc?.numPages ?? 0;
	const pdfView = useRef<PdfViewHandle>(null);
	const goToPage = (n: number) => pdfView.current?.goToPage(Math.min(Math.max(1, n), pages));

	// 사이드바: 처음에는 쪽이 여럿이거나 파일이 여럿일 때 보인다. 버튼으로 고르면 그대로 둔다
	const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
	const sidebar = file !== null && (sidebarChoice ?? (files.length > 1 || pages > 1));

	// 찾기
	const search = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState('');
	const q = query.trim();
	// 쪽마다 찾은 개수. 지금 문서·찾는 말의 결과만 쓴다 (늦게 온 옛 결과는 버린다)
	const [found, setFound] = useState<{ doc: PDFDocumentProxy | null; query: string; counts: number[] }>({
		doc: null,
		query: '',
		counts: [],
	});
	const matchCounts = found.doc === doc && found.query === q ? found.counts : [];
	const total = matchCounts.reduce((sum, n) => sum + n, 0);
	useEffect(() => {
		if (!doc || !q) return;
		let alive = true;
		const timer = setTimeout(() => {
			countMatches(doc, q).then((counts) => alive && setFound({ doc, query: q, counts }));
		}, 150);
		return () => {
			alive = false;
			clearTimeout(timer);
		};
	}, [doc, q]);
	// 고른 결과: 찾는 말이 바뀌면 첫 결과부터
	const [picked, setPicked] = useState({ query: '', index: 0 });
	const match = total === 0 ? -1 : picked.query === q ? picked.index % total : 0;
	const moveMatch = (direction: 1 | -1) =>
		total > 0 && setPicked({ query: q, index: (match + direction + total) % total });

	// 다른 파일로 가면 쪽·찾기를 처음부터 (그리는 중에 맞춘다)
	const [shown, setShown] = useState(current);
	if (shown !== current) {
		setShown(current);
		setPage(1);
		setQuery('');
	}

	const onScale = useCallback((value: number) => setScale(value), []);

	useAppMenus('preview', [
		{
			title: '편집',
			items: [
				{
					label: '찾기…',
					disabled: !doc,
					shortcut: { code: 'KeyF', mod: true },
					onSelect: () => search.current?.querySelector('input')?.focus(),
				},
				{
					label: '다음 찾기',
					disabled: total === 0,
					shortcut: { code: 'KeyG', mod: true },
					onSelect: () => moveMatch(1),
				},
				{
					label: '이전 찾기',
					disabled: total === 0,
					shortcut: { code: 'KeyG', mod: true, shift: true },
					onSelect: () => moveMatch(-1),
				},
			],
		},
		{
			title: '보기',
			items: [
				{
					label: sidebar ? '사이드바 가리기' : '사이드바 보기',
					disabled: !file,
					shortcut: { code: 'KeyS', mod: true, alt: true },
					onSelect: () => setSidebarChoice(!sidebar),
				},
				'separator',
				{
					label: '실제 크기',
					disabled: !file,
					checked: zoom === 1,
					shortcut: { code: 'Digit0', mod: true },
					onSelect: () => setZoom(1),
				},
				{
					label: '크기 조절하여 맞추기',
					disabled: !file,
					checked: file !== null && zoom === null,
					shortcut: { code: 'Digit9', mod: true },
					onSelect: () => setZoom(null),
				},
				{
					label: '확대',
					disabled: !file || nextZoom(scale, 1) === null,
					shortcut: { code: 'Equal', mod: true },
					onSelect: () => step(1),
				},
				{
					label: '축소',
					disabled: !file || nextZoom(scale, -1) === null,
					shortcut: { code: 'Minus', mod: true },
					onSelect: () => step(-1),
				},
			],
		},
		{
			title: '도구',
			items: [
				{ label: '왼쪽으로 회전', disabled: !file, onSelect: () => rotate(-90) },
				{ label: '오른쪽으로 회전', disabled: !file, onSelect: () => rotate(90) },
			],
		},
		{
			title: '이동',
			items: [
				{
					label: '이전 페이지',
					disabled: page <= 1,
					shortcut: { code: 'ArrowUp', mod: true, alt: true },
					onSelect: () => goToPage(page - 1),
				},
				{
					label: '다음 페이지',
					disabled: page >= pages,
					shortcut: { code: 'ArrowDown', mod: true, alt: true },
					onSelect: () => goToPage(page + 1),
				},
				{ label: '처음 페이지', disabled: pages === 0, onSelect: () => goToPage(1) },
				{ label: '마지막 페이지', disabled: pages === 0, onSelect: () => goToPage(pages) },
			],
		},
	]);

	/** 본문의 키: ←→로 쪽을 넘기고, Home·End로 처음·끝 */
	const onKeyDown = (event: React.KeyboardEvent) => {
		if (!doc || event.metaKey || event.ctrlKey || event.altKey) return;
		const moves: Record<string, number> = { ArrowLeft: page - 1, ArrowRight: page + 1, Home: 1, End: pages };
		if (event.key in moves) {
			event.preventDefault();
			goToPage(moves[event.key]);
		}
	};

	const subtitle = !file
		? ''
		: file.kind === 'pdf'
			? pages > 0
				? `${pages}페이지 중 ${page}페이지`
				: 'PDF 문서'
			: `이미지${file.size !== undefined ? ` · ${formatSize(file.size)}` : ''}`;

	return (
		<AppWindow title={file?.name ?? '미리보기'} appName="preview" chrome="unified">
			<div className={`preview${sidebar ? ' with-sidebar' : ''}`}>
				<header className="preview-toolbar">
					{file && <SidebarToggle open={sidebar} onToggle={() => setSidebarChoice(!sidebar)} />}
					<div className="preview-title">
						<h1>{file?.name ?? '미리보기'}</h1>
						{subtitle && <p aria-live="polite">{subtitle}</p>}
					</div>
					{file && (
						<div className="preview-tools">
							<IconButton
								icon="fa-solid fa-circle-info"
								label="정보"
								aria-haspopup="menu"
								aria-expanded={popup?.kind === 'info'}
								onClick={openPopup('info')}
							/>
							<span className="preview-zoom" role="group" aria-label="배율">
								<IconButton
									icon="fa-solid fa-magnifying-glass-minus"
									label="축소"
									disabled={nextZoom(scale, -1) === null}
									onClick={() => step(-1)}
								/>
								<IconButton
									icon="fa-solid fa-magnifying-glass-plus"
									label="확대"
									disabled={nextZoom(scale, 1) === null}
									onClick={() => step(1)}
								/>
							</span>
							<IconButton
								icon="fa-solid fa-arrow-up-from-bracket"
								label="공유"
								aria-haspopup="menu"
								aria-expanded={popup?.kind === 'share'}
								onClick={openPopup('share')}
							/>
							<IconButton icon="fa-solid fa-rotate-left" label="왼쪽으로 회전" onClick={() => rotate(-90)} />
							{file.kind === 'pdf' && (
								<div ref={search} className="preview-search">
									<SearchField
										label="찾기"
										className="preview-search-field"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												moveMatch(event.shiftKey ? -1 : 1);
											} else if (event.key === 'Escape') {
												setQuery('');
											}
										}}
									/>
									{q && (
										<span className="preview-search-count" aria-live="polite">
											{total === 0 ? '없음' : `${match + 1}/${total}`}
										</span>
									)}
								</div>
							)}
						</div>
					)}
				</header>
				{file && popup && (
					<Menu
						label={popup.kind === 'info' ? '정보' : '공유'}
						anchor={popup}
						onClose={() => setPopup(null)}
						items={
							popup.kind === 'info'
								? infoItems(file, pages, scale, zoom)
								: [
										{
											label: '다운로드',
											icon: 'fa-solid fa-download',
											onSelect: () => downloadFile(file.key, file.name),
										},
										{
											label: '새 탭에서 열기',
											icon: 'fa-solid fa-arrow-up-right-from-square',
											onSelect: () => openFileInNewTab(file.key),
										},
									]
						}
					/>
				)}

				<div className="preview-body">
					{sidebar && (
						<nav className="preview-sidebar" aria-label="사이드바">
							{files.map((open) => (
								<SidebarFile
									key={open.key}
									file={open}
									doc={docs[open.key]}
									current={open.key === current}
									currentPage={open.key === current ? page : 0}
									showHeader={files.length > 1}
									onPick={(n) => {
										if (open.key !== current) selectInPreview(open.key);
										else if (n) goToPage(n);
									}}
								/>
							))}
						</nav>
					)}
					<main className="preview-main" onKeyDown={onKeyDown}>
						{!file ? (
							<PreviewEmpty />
						) : file.kind === 'image' ? (
							<ImageView
								key={file.key}
								fileKey={file.key}
								name={file.name}
								zoom={zoom}
								rotation={rotation}
								onScale={onScale}
							/>
						) : docs[file.key] === 'error' ? (
							<p className="preview-note">PDF를 열 수 없습니다.</p>
						) : doc ? (
							<PdfView
								key={file.key}
								ref={pdfView}
								doc={doc}
								zoom={zoom}
								onScale={onScale}
								onPage={setPage}
								query={q}
								matchCounts={matchCounts}
								activeMatch={match}
								label={file.name}
								rotation={rotation}
							/>
						) : (
							<p className="preview-note">여는 중…</p>
						)}
					</main>
				</div>
			</div>
		</AppWindow>
	);
};

/** 사이드바의 파일 하나: (파일이 여럿이면) 이름 줄, 그리고 쪽 그림 */
const SidebarFile: React.FC<{
	file: PreviewFile;
	doc: PDFDocumentProxy | 'error' | undefined;
	current: boolean;
	currentPage: number;
	showHeader: boolean;
	onPick: (page: number) => void;
}> = ({ file, doc, current, currentPage, showHeader, onPick }) => (
	<section className={`preview-side-file${current ? ' current' : ''}`} aria-label={file.name}>
		{showHeader && (
			<div className="preview-side-head">
				<span>{file.name}</span>
				<IconButton icon="fa-solid fa-xmark" label={`${file.name} 닫기`} onClick={() => closeInPreview(file.key)} />
			</div>
		)}
		<div className="preview-thumbs">
			{file.kind === 'image' ? (
				<button
					type="button"
					className={`preview-thumb${current ? ' active' : ''}`}
					aria-label={file.name}
					aria-current={current ? 'true' : undefined}
					onClick={() => onPick(0)}
				>
					<img src={fileUrl(file.key)} alt="" draggable={false} />
				</button>
			) : typeof doc === 'object' ? (
				Array.from({ length: doc.numPages }, (_, i) => (
					<button
						key={i}
						type="button"
						className={`preview-thumb${current && currentPage === i + 1 ? ' active' : ''}`}
						aria-label={showHeader ? `${file.name} ${i + 1}쪽` : `${i + 1}쪽`}
						aria-current={current && currentPage === i + 1 ? 'page' : undefined}
						onClick={() => onPick(i + 1)}
					>
						<PdfThumb doc={doc} number={i + 1} width={THUMB_WIDTH} />
						<span>{i + 1}</span>
					</button>
				))
			) : (
				<i className="fa-solid fa-file-pdf preview-thumb-icon" aria-hidden="true" />
			)}
		</div>
	</section>
);

/** 정보(ⓘ) 메뉴: 이름, 종류, 크기, 쪽 수, 배율 */
function infoItems(file: PreviewFile, pages: number, scale: number, zoom: number | null): MenuItem[] {
	return [
		{ heading: file.name },
		{ note: file.kind === 'pdf' ? `PDF 문서${pages > 0 ? ` · ${pages}페이지` : ''}` : '이미지' },
		...(file.size !== undefined ? [{ note: `크기: ${formatSize(file.size)}` }] : []),
		{ note: `배율: ${zoom === null ? `맞춤 (${Math.round(scale * 100)}%)` : `${Math.round(zoom * 100)}%`}` },
	];
}

const PreviewEmpty: React.FC = () => {
	const { openApp, bringAppToFront } = useAppState();
	return (
		<div className="preview-empty">
			<i className="fa-regular fa-images" aria-hidden="true" />
			<p>열린 파일이 없습니다.</p>
			<p className="preview-empty-note">Finder의 문서 폴더에서 PDF나 그림을 열면 여기에 보입니다.</p>
			<button
				type="button"
				className="ui-button"
				onClick={() => {
					openApp('finder');
					bringAppToFront('finder');
				}}
			>
				Finder 열기
			</button>
		</div>
	);
};

export default Preview;
