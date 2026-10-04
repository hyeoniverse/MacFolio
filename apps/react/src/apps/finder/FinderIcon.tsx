import React from 'react';
import { env } from '@/shared/config/env';
import type { FinderItem } from './files';

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

/** 항목 아이콘. 프로젝트·앱은 그 아이콘 그림, 나머지는 그린 아이콘 */
const FinderIcon: React.FC<{ item: FinderItem }> = ({ item }) => {
	switch (item.kind) {
		case 'folder':
			return <FolderSvg />;
		case 'doc':
			return <PageSvg variant="doc" />;
		case 'post':
			return <PageSvg variant="post" />;
		case 'project':
			return item.icon ? <img className="finder-img" src={item.icon} alt="" draggable={false} /> : <FolderSvg />;
		case 'app':
			return <img className="finder-img" src={`${env.imageUrl}/${item.icon}`} alt="" draggable={false} />;
	}
};

export default FinderIcon;
