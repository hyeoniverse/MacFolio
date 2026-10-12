// bento의 링크 묶음: 공용 LandingLinks와 같은 링크(차례, data-link·data-primary, 앱은 단추)에 키보드 글쇠 모양의 작은 표시를 단다.
// 표시는 장식이라 aria-hidden이고 링크 이름에 섞이지 않는다
import React from 'react';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import type { LandingLink } from '@/apps/safari/project/landing';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 링크 종류마다의 표시: 여기서 열기는 Enter 글쇠, 데모는 바깥으로 나가는 화살표, 저장소는 GitHub 아이콘 */
const Hint: React.FC<{ kind: LandingLink['kind'] }> = ({ kind }) =>
	kind === 'app' ? (
		<kbd className="bt-kbd bt-btn-kbd" aria-hidden="true">
			↵
		</kbd>
	) : (
		<i
			className={kind === 'repo' ? 'fa-brands fa-github' : 'fa-solid fa-arrow-up-right-from-square'}
			aria-hidden="true"
		/>
	);

export const BentoLinks: React.FC<{ links: LandingLink[]; className?: string }> = ({ links, className }) => {
	const { openApp } = useAppState();
	if (links.length === 0) return null;
	return (
		<div className={['bt-links', className].filter(Boolean).join(' ')}>
			{links.map((link, index) => {
				const marks = {
					className: index === 0 ? 'bt-btn bt-btn-solid' : 'bt-btn',
					'data-link': link.kind,
					'data-primary': index === 0 ? '' : undefined,
				};
				return link.kind === 'app' ? (
					<button key={link.kind} type="button" {...marks} onClick={() => openApp(link.app as AppName)}>
						{link.label}
						<Hint kind={link.kind} />
					</button>
				) : (
					<a key={link.kind} href={link.href} {...external} {...marks}>
						{link.kind === 'repo' && <Hint kind="repo" />}
						{link.label}
						{link.kind === 'demo' && <Hint kind="demo" />}
					</a>
				);
			})}
		</div>
	);
};
