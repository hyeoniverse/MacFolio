import React from 'react';
import { env } from '@/shared/config/env';
import { mediaKind, type FinderItem } from './files';
import { fileUrl } from './documents';

/** 폴더 앞면에 얹는 문양의 선 (macOS처럼 폴더보다 진한 파랑으로 눌러 찍은 듯이) */
const GLYPH = {
	fill: 'none',
	stroke: '#2f7fcb',
	strokeWidth: 2.2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
} as const;

/**
 * macOS 기본 폴더의 문양 (폴더 id → 앞면 가운데에 그릴 선). 앞면은 y 13~50, 가운데는 (32, 31.5).
 * 없는 폴더는 문양 없이 그린다
 */
const FOLDER_GLYPHS: Record<string, React.ReactNode> = {
	// 데스크탑: 모니터
	desktop: (
		<g {...GLYPH}>
			<rect x="21" y="22" width="22" height="15" rx="2" />
			<path d="M28 42h8M32 37v5" />
		</g>
	),
	// 문서: 귀퉁이가 접힌 종이
	docs: (
		<g {...GLYPH}>
			<path d="M26 21h8l6 6v15a1.5 1.5 0 0 1-1.5 1.5h-12.5a1.5 1.5 0 0 1-1.5-1.5v-19.5a1.5 1.5 0 0 1 1.5-1.5z" />
			<path d="M34 21v6h6" />
		</g>
	),
	// 다운로드: 동그라미 안의 아래 화살표
	downloads: (
		<g {...GLYPH}>
			<circle cx="32" cy="32" r="10" />
			<path d="M32 26v11M27.5 32.5 32 37l4.5-4.5" />
		</g>
	),
	// 그림: 액자 안의 산과 해
	pictures: (
		<g {...GLYPH}>
			<rect x="21" y="23" width="22" height="17" rx="2" />
			<path d="m23 38 6-7 4 4 3-3 5 6" />
			<circle cx="37.5" cy="27.5" r="1.6" />
		</g>
	),
	// 동영상: 필름
	movies: (
		<g {...GLYPH}>
			<rect x="21" y="22" width="22" height="19" rx="2" />
			<path d="M26 22v19M38 22v19M21 28h5M21 35h5M38 28h5M38 35h5" />
		</g>
	),
	// 음악: 음표
	music: (
		<g {...GLYPH}>
			<path d="M29 39V25l10-2.5v14" />
			<circle cx="26.5" cy="39" r="2.5" />
			<circle cx="36.5" cy="36.5" r="2.5" />
		</g>
	),
	// 공용: 마름모 표지판 안의 걷는 사람
	public: (
		<g {...GLYPH}>
			<path d="M32 20.5 43 31.5 32 42.5 21 31.5z" />
			<circle cx="32.5" cy="26.5" r="1.3" />
			<path d="M32 29v4.5l-2.5 3.5M32 33.5l2.5 3.5M29.5 31l2.5-1.5 2.5 1.5" />
		</g>
	),
	// 블로그: 연필
	blog: (
		<g {...GLYPH}>
			<path d="m24 40 1.5-5.5L36 24l4 4-10.5 10.5z" />
			<path d="m33.5 26.5 4 4" />
		</g>
	),
	// 응용 프로그램: macOS처럼 연필·붓·자로 만든 A
	apps: (
		<g {...GLYPH}>
			<path d="M26 41 32 22l6 19M28 35h8" />
		</g>
	),
	// 홈: 집
	home: (
		<g {...GLYPH}>
			<path d="M22 31.5 32 23l10 8.5" />
			<path d="M25 29v12h14V29" />
			<path d="M30 41v-6h4v6" />
		</g>
	),
	// 사용자: 두 사람
	users: (
		<g {...GLYPH}>
			<circle cx="28" cy="27" r="3.2" />
			<path d="M21.5 40a6.5 6.5 0 0 1 13 0" />
			<circle cx="37.5" cy="28.5" r="2.6" />
			<path d="M35.5 34.5a5.5 5.5 0 0 1 7.5 5.5" />
		</g>
	),
};

/** 디스크 (Macintosh HD): 은색 외장 디스크처럼 */
const DriveSvg = () => (
	<svg viewBox="0 0 64 52" aria-hidden="true" className="finder-svg">
		<defs>
			<linearGradient id="finder-drive" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#f2f2f5" />
				<stop offset="1" stopColor="#c7c7cc" />
			</linearGradient>
		</defs>
		<rect x="4" y="12" width="56" height="30" rx="5" fill="url(#finder-drive)" stroke="#a1a1a6" strokeWidth="1.2" />
		<rect x="4" y="12" width="56" height="2" rx="1" fill="#ffffff" opacity="0.8" />
		<circle cx="52" cy="34" r="1.8" fill="#34c759" />
		{[12, 17, 22, 27].map((x) => (
			<rect key={x} x={x} y="32" width="2" height="5" rx="1" fill="#8e8e93" />
		))}
	</svg>
);

/** macOS 폴더: 탭이 달린 파란 폴더. glyph가 있으면 앞면에 얹는다 */
const FolderSvg: React.FC<{ glyph?: React.ReactNode }> = ({ glyph }) => (
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
		{glyph}
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
			return item.id === 'mac' ? <DriveSvg /> : <FolderSvg glyph={FOLDER_GLYPHS[item.id]} />;
		case 'alias':
			return (
				<>
					<FolderSvg />
					<AliasBadge />
				</>
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
