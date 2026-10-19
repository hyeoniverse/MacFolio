// 첫 화면과 마무리의 링크 묶음: 이 사이트 안에서 열기(버튼), 데모(새 탭), 저장소. 첫 링크에 data-primary가 붙는다 (템플릿이 꽉 찬 버튼으로 그린다)
import React from 'react';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import type { LandingLink } from './content';
import { useShownLinks } from './slides';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export const LandingLinks: React.FC<{ links: LandingLink[]; className?: string }> = ({ links: all, className }) => {
	const { openApp } = useAppState();
	const { links, openSlides } = useShownLinks(all);
	if (links.length === 0) return null;
	return (
		<div className={['lk-links', className].filter(Boolean).join(' ')}>
			{links.map((link, index) => {
				const marks = { 'data-link': link.kind, 'data-primary': index === 0 ? '' : undefined };
				return link.kind === 'app' ? (
					<button key={link.kind} type="button" {...marks} onClick={() => openApp(link.app as AppName)}>
						{link.label}
					</button>
				) : link.kind === 'slides' ? (
					<button key={link.kind} type="button" {...marks} onClick={openSlides}>
						{link.label}
						{index > 0 && <i className="fa-solid fa-chevron-right" aria-hidden="true" />}
					</button>
				) : (
					<a key={link.kind} href={link.href} {...external} {...marks}>
						{link.label}
						{index > 0 && <i className="fa-solid fa-chevron-right" aria-hidden="true" />}
					</a>
				);
			})}
		</div>
	);
};
