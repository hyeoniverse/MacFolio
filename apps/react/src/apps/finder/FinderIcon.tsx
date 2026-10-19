import React from 'react';
import { env } from '@/shared/config/env';
import { mediaKind, type FinderItem } from './files';
import { fileUrl } from './documents';

/** macOS 폴더: 탭이 달린 파란 폴더 */
const FolderSvg = () => (
	<svg viewBox="0 0 64 52" aria-hidden="true" className="finder-svg">
		<defs>
			<linearGradient id="finder-folder-back" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#5fb3f5" />
				<stop offset="1" stopColor="#3d93e0" />
			</linearGradient>
			<linearGradient id="finder-folder-front" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#8fd0ff" />
				<stop offset="1" stopColor="#5db4f6" />
			</linearGradient>
		</defs>
		<path
			d="M4 6a4 4 0 0 1 4-4h14l5 5h29a4 4 0 0 1 4 4v35a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"
			fill="url(#finder-folder-back)"
		/>
		<rect x="4" y="13" width="56" height="37" rx="4" fill="url(#finder-folder-front)" />
		<rect x="4" y="13" width="56" height="1.5" rx="0.75" fill="#ffffff" opacity="0.55" />
	</svg>
);

/** 문서: 귀퉁이가 접힌 흰 종이. 문서는 파란 MD 딱지, 글은 메모처럼 노란 머리 */
const PageSvg: React.FC<{ variant: 'doc' | 'post' }> = ({ variant }) => (
	<svg viewBox="0 0 48 60" aria-hidden="true" className="finder-svg">
		<path
			d="M6 2h26l12 12v40a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"
			fill="#ffffff"
			stroke="#c9c9ce"
			strokeWidth="1.2"
		/>
		<path d="M32 2v8a4 4 0 0 0 4 4h8" fill="#e9e9ee" stroke="#c9c9ce" strokeWidth="1.2" />
		{variant === 'post' && <path d="M2.6 6a3.4 3.4 0 0 1 3.4-3.4h26v9H2.6z" fill="#ffd54a" />}
		{[22, 28, 34, 40].map((y) => (
			<rect key={y} x="9" y={y} width={y === 40 ? 18 : 30} height="2" rx="1" fill="#d6d6dc" />
		))}
		{variant === 'doc' && (
			<>
				<rect x="9" y="45" width="22" height="10" rx="2.5" fill="#3b82f6" />
				<text
					x="20"
					y="52.6"
					textAnchor="middle"
					fontSize="7"
					fontWeight="700"
					fill="#ffffff"
					fontFamily="system-ui, sans-serif"
				>
					MD
				</text>
			</>
		)}
	</svg>
);

/** PDF: 빨간 PDF 딱지가 붙은 종이 */
const PdfSvg = () => (
	<svg viewBox="0 0 48 60" aria-hidden="true" className="finder-svg">
		<path
			d="M6 2h26l12 12v40a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"
			fill="#ffffff"
			stroke="#c9c9ce"
			strokeWidth="1.2"
		/>
		<path d="M32 2v8a4 4 0 0 0 4 4h8" fill="#e9e9ee" stroke="#c9c9ce" strokeWidth="1.2" />
		{[20, 26, 32].map((y) => (
			<rect key={y} x="9" y={y} width={y === 32 ? 18 : 30} height="2" rx="1" fill="#d6d6dc" />
		))}
		<rect x="9" y="42" width="26" height="12" rx="2.5" fill="#e5483f" />
		<text
			x="22"
			y="51"
			textAnchor="middle"
			fontSize="8"
			fontWeight="700"
			fill="#ffffff"
			fontFamily="system-ui, sans-serif"
		>
			PDF
		</text>
	</svg>
);

/** 그 밖의 파일: 회색 확장자 딱지가 붙은 종이 (DOCX, ZIP, MP4 …) */
const FileSvg: React.FC<{ ext: string }> = ({ ext }) => (
	<svg viewBox="0 0 48 60" aria-hidden="true" className="finder-svg">
		<path
			d="M6 2h26l12 12v40a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"
			fill="#ffffff"
			stroke="#c9c9ce"
			strokeWidth="1.2"
		/>
		<path d="M32 2v8a4 4 0 0 0 4 4h8" fill="#e9e9ee" stroke="#c9c9ce" strokeWidth="1.2" />
		<rect x="7" y="42" width="30" height="12" rx="2.5" fill="#8e8e93" />
		<text
			x="22"
			y="51"
			textAnchor="middle"
			fontSize={ext.length > 3 ? 6.5 : 8}
			fontWeight="700"
			fill="#ffffff"
			fontFamily="system-ui, sans-serif"
		>
			{ext}
		</text>
	</svg>
);

/** 가상본(alias) 표시: macOS처럼 아이콘 왼쪽 아래의 작은 흰 상자와 휘어 올라가는 검은 화살표 */
const AliasBadge = () => (
	<svg viewBox="0 0 16 16" aria-hidden="true" className="finder-alias-badge">
		<rect
			x="0.75"
			y="0.75"
			width="14.5"
			height="14.5"
			rx="3"
			fill="#ffffff"
			stroke="rgba(0,0,0,0.25)"
			strokeWidth="0.75"
		/>
		<path
			d="M4.5 12.2V9.4a3.4 3.4 0 0 1 3.4-3.4h2.6"
			fill="none"
			stroke="#1d1d1f"
			strokeWidth="1.7"
			strokeLinecap="round"
		/>
		<path
			d="M9.2 3.4 12 6l-2.8 2.6"
			fill="none"
			stroke="#1d1d1f"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

/** 항목 아이콘. 프로젝트·앱은 그 아이콘 그림, 나머지는 그린 아이콘 */
const FinderIcon: React.FC<{ item: FinderItem }> = ({ item }) => {
	switch (item.kind) {
		case 'folder':
			return item.aliasOf ? (
				<>
					<FolderSvg />
					<AliasBadge />
				</>
			) : (
				<FolderSvg />
			);
		case 'doc':
			return <PageSvg variant="doc" />;
		case 'post':
			return <PageSvg variant="post" />;
		case 'project':
			return item.icon ? <img className="finder-img" src={item.icon} alt="" draggable={false} /> : <FolderSvg />;
		case 'pdf':
			return <PdfSvg />;
		case 'file':
			// 동영상은 macOS처럼 첫 장면을 작게 (재생 표시를 얹는다)
			if (mediaKind(item.name) === 'video')
				return (
					<span className="finder-video-thumb">
						<video src={`${fileUrl(item.key)}#t=0.5`} preload="metadata" muted playsInline aria-hidden="true" />
						<i className="fa-solid fa-play" aria-hidden="true" />
					</span>
				);
			return <FileSvg ext={item.name.split('.').pop()?.toUpperCase().slice(0, 4) ?? ''} />;
		case 'image':
			// macOS처럼 그림은 그 그림을 작게 (사진 폴더의 사진, 올린 그림)
			return (
				<img className="finder-img finder-thumb" src={fileUrl(item.key)} alt="" loading="lazy" draggable={false} />
			);
		case 'app':
			return <img className="finder-img" src={`${env.imageUrl}/${item.icon}`} alt="" draggable={false} />;
	}
};

export default FinderIcon;
