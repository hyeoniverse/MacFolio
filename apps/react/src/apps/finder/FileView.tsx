import React, { useState } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import '@/shared/ui/button/Button.css';
import { fileUrl, formatSize } from './documents';
import type { FileItem } from './files';

/**
 * 휴대폰 파일 앱의 문서 파일 미리 보기 (PDF·그림, iOS의 훑어보기처럼 앱 안에서). 데스크톱은 미리보기 앱(apps/preview)이 연다. 파일은 R2에 있고 사이트와 같은 주소(/files/<key>)로 온다.
 * PDF는 브라우저의 PDF 보기를 iframe으로 띄우고 (CSP frame-src 'self'), 그림은 칸에 맞춰 보이며 눌러서 원래 크기로 본다.
 * 위 막대: 이름·크기, 다운로드(?download=1), 새 창에서 열기
 */
const FileView: React.FC<{ item: FileItem }> = ({ item }) => {
	const [zoomed, setZoomed] = useState(false);
	const src = fileUrl(item.key);
	return (
		<section key={item.id} className="finder-file motion-swap" aria-label={item.name}>
			<div className="finder-file-bar">
				<span className="finder-file-info">
					{item.kind === 'pdf' ? 'PDF 문서' : '이미지'}
					{item.size !== undefined && ` · ${formatSize(item.size)}`}
				</span>
				{item.kind === 'image' && (
					<IconButton
						icon={zoomed ? 'fa-solid fa-magnifying-glass-minus' : 'fa-solid fa-magnifying-glass-plus'}
						label={zoomed ? '칸에 맞추기' : '원래 크기로 보기'}
						aria-pressed={zoomed}
						on={zoomed}
						onClick={() => setZoomed(!zoomed)}
					/>
				)}
				<a className="ui-button finder-file-action" href={fileUrl(item.key, true)} download={item.name}>
					<i className="fa-solid fa-download" aria-hidden="true" />
					다운로드
				</a>
				<a className="ui-button finder-file-action" href={src} target="_blank" rel="noopener noreferrer">
					<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />새 창에서 열기
				</a>
			</div>
			{item.kind === 'pdf' ? (
				<iframe className="finder-file-pdf" src={src} title={item.name} />
			) : (
				<div className={`finder-file-image${zoomed ? ' zoomed' : ''}`}>
					<img src={src} alt={item.name} draggable={false} onClick={() => setZoomed(!zoomed)} />
				</div>
			)}
		</section>
	);
};

export default FileView;
