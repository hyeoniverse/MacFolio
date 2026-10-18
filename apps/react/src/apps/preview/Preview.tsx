import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import IconButton from '@/shared/ui/button/IconButton';
import '@/shared/ui/button/Button.css';
import { useAppState } from '@/desktop/useAppState';
import { fileUrl, formatSize } from '@/apps/finder/documents';
import { closeInPreview, selectInPreview, usePreview, type PreviewFile } from './previewStore';
import './Preview.css';

/** 그림 배율. null이면 창에 맞춘다 */
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/**
 * 미리보기 (macOS 미리보기). Finder의 문서 파일(PDF·그림)을 연다. 파일은 R2에 있고 사이트와 같은 주소(/files/<key>)로 온다.
 * - PDF는 브라우저의 PDF 보기를 iframe으로 (CSP frame-src 'self'). 확대·쪽 넘기기는 그 보기가 한다
 * - 그림은 창에 맞춰 보이고, 도구 막대로 확대·축소·실제 크기
 * - 파일을 둘 이상 열면 왼쪽 사이드바에 목록이 생긴다
 */
const Preview: React.FC = () => {
	const { files, current } = usePreview();
	const file = files.find((open) => open.key === current) ?? null;
	const [sidebar, setSidebar] = useState(true);
	// 그림 배율은 파일마다 따로 기억한다 (없으면 창에 맞춤)
	const [zooms, setZooms] = useState<Record<string, number | null>>({});
	const zoom = file ? (zooms[file.key] ?? null) : null;
	const setZoom = (next: number | null) => file && setZooms({ ...zooms, [file.key]: next });
	const showSidebar = sidebar && files.length > 1;

	return (
		<AppWindow title={file?.name ?? '미리보기'} appName="preview">
			<div className="preview">
				<PreviewToolbar
					file={file}
					zoom={zoom}
					onZoom={setZoom}
					count={files.length}
					sidebar={showSidebar}
					onToggleSidebar={() => setSidebar(!sidebar)}
				/>
				<div className="preview-body">
					{showSidebar && (
						<nav className="preview-sidebar" aria-label="열린 파일">
							{files.map((open) => (
								<div key={open.key} className={`preview-thumb${open.key === current ? ' active' : ''}`}>
									<button
										type="button"
										className="preview-thumb-open"
										aria-current={open.key === current ? 'true' : undefined}
										onClick={() => selectInPreview(open.key)}
									>
										{open.kind === 'image' ? (
											<img src={fileUrl(open.key)} alt="" draggable={false} />
										) : (
											<i className="fa-solid fa-file-pdf" aria-hidden="true" />
										)}
										<span>{open.name}</span>
									</button>
									<IconButton
										className="preview-thumb-close"
										icon="fa-solid fa-xmark"
										label={`${open.name} 닫기`}
										onClick={() => closeInPreview(open.key)}
									/>
								</div>
							))}
						</nav>
					)}
					{file ? <PreviewContent key={file.key} file={file} zoom={zoom} /> : <PreviewEmpty />}
				</div>
			</div>
		</AppWindow>
	);
};

const PreviewToolbar: React.FC<{
	file: PreviewFile | null;
	zoom: number | null;
	onZoom: (zoom: number | null) => void;
	count: number;
	sidebar: boolean;
	onToggleSidebar: () => void;
}> = ({ file, zoom, onZoom, count, sidebar, onToggleSidebar }) => (
	<div className="preview-toolbar">
		{count > 1 && (
			<IconButton
				icon="fa-solid fa-table-columns"
				label={sidebar ? '사이드바 가리기' : '사이드바 보기'}
				aria-pressed={sidebar}
				on={sidebar}
				onClick={onToggleSidebar}
			/>
		)}
		<span className="preview-info">
			{file && (
				<>
					{file.kind === 'pdf' ? 'PDF 문서' : '이미지'}
					{file.size !== undefined && ` · ${formatSize(file.size)}`}
				</>
			)}
		</span>
		{file && (
			<>
				{file.kind === 'image' && <ZoomControls zoom={zoom} onZoom={onZoom} />}
				<a className="ui-button preview-action" href={fileUrl(file.key, true)} download={file.name}>
					<i className="fa-solid fa-download" aria-hidden="true" />
					다운로드
				</a>
				<a className="ui-button preview-action" href={fileUrl(file.key)} target="_blank" rel="noopener noreferrer">
					<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />새 창에서 열기
				</a>
			</>
		)}
	</div>
);

const ZoomControls: React.FC<{ zoom: number | null; onZoom: (zoom: number | null) => void }> = ({ zoom, onZoom }) => {
	const level = zoom ?? 1;
	const smaller = [...ZOOMS].reverse().find((step) => step < level - 0.001);
	const larger = ZOOMS.find((step) => step > level + 0.001);
	return (
		<span className="preview-zoom" role="group" aria-label="배율">
			<IconButton
				icon="fa-solid fa-magnifying-glass-minus"
				label="축소"
				disabled={!smaller}
				onClick={() => smaller && onZoom(smaller)}
			/>
			<button
				type="button"
				className="ui-button preview-zoom-level"
				aria-pressed={zoom === null}
				title={zoom === null ? '실제 크기로 보기' : '창에 맞추기'}
				onClick={() => onZoom(zoom === null ? 1 : null)}
			>
				{zoom === null ? '맞춤' : `${Math.round(zoom * 100)}%`}
			</button>
			<IconButton
				icon="fa-solid fa-magnifying-glass-plus"
				label="확대"
				disabled={!larger}
				onClick={() => larger && onZoom(larger)}
			/>
		</span>
	);
};

const PreviewContent: React.FC<{ file: PreviewFile; zoom: number | null }> = ({ file, zoom }) => {
	const src = fileUrl(file.key);
	if (file.kind === 'pdf') {
		return (
			<section className="preview-content" aria-label={file.name}>
				<iframe className="preview-pdf" src={src} title={file.name} />
			</section>
		);
	}
	return (
		<section className={`preview-content preview-image${zoom === null ? '' : ' zoomed'}`} aria-label={file.name}>
			<img
				src={src}
				alt={file.name}
				draggable={false}
				style={zoom === null ? undefined : { width: `calc(var(--natural-width) * ${zoom})` }}
				onLoad={(event) =>
					event.currentTarget.style.setProperty('--natural-width', `${event.currentTarget.naturalWidth}px`)
				}
			/>
		</section>
	);
};

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
