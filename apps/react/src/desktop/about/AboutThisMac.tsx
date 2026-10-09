import { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { openExternal } from '@/shared/analytics/analytics';
import { PROFILE, SKILLS } from '@/shared/profile';
import { closeAbout, useAboutOpen } from './aboutStore';
import './AboutThisMac.css';

const GITHUB_LOGIN = PROFILE.github.split('/').at(-1) ?? '';
/** GitHub 프로필 사진. 132px 동그라미를 레티나 화면에서도 또렷하게 (2배) */
const PHOTO = `https://github.com/${encodeURIComponent(GITHUB_LOGIN)}.png?size=280`;

/** 이 Mac의 사양 자리에 놓는 프로필 (macOS의 칩·메모리·일련 번호·macOS 줄처럼) */
const ROWS: { label: string; value: string; href?: string }[] = [
	{ label: '역할', value: PROFILE.role },
	{ label: '학교', value: PROFILE.school },
	{ label: '위치', value: PROFILE.location },
	{ label: '이메일', value: PROFILE.email, href: `mailto:${PROFILE.email}` },
	{ label: 'GitHub', value: GITHUB_LOGIN, href: PROFILE.github },
	{ label: '주요 기술', value: SKILLS.frontend.slice(0, 3).join(' · ') },
];

/**
 * Apple 메뉴의 '이 Mac에 관하여': macOS의 같은 창처럼 가운데 작은 창에 그림, 이름, 사양 줄, '추가 정보…'.
 * 이 Mac 대신 만든 사람(김정현)의 프로필을 보여 준다. 앱이 아니라 시스템 창이라 Dock·Finder에는 없다.
 * 창의 빈 곳을 잡아 옮기고, 닫기 단추나 Esc로 닫는다 (최소화·확대는 macOS처럼 꺼져 있다)
 */
const AboutThisMac = () => {
	const open = useAboutOpen();
	const { openApp } = useAppState();
	/** 가운데에서 옮긴 만큼 */
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [photo, setPhoto] = useState(true);
	const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);
	const closeButton = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		closeButton.current?.focus();
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closeAbout();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="about-mac"
			role="dialog"
			aria-label="이 Mac에 관하여"
			style={{ translate: `${offset.x}px ${offset.y}px` }}
			onPointerDown={(event) => {
				// 단추·링크·글자를 고를 때는 옮기지 않는다
				if ((event.target as Element).closest('button, a, dd')) return;
				drag.current = { x: event.clientX, y: event.clientY, from: offset };
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				const start = drag.current;
				if (!start) return;
				setOffset({ x: start.from.x + event.clientX - start.x, y: start.from.y + event.clientY - start.y });
			}}
			onPointerUp={() => {
				drag.current = null;
			}}
		>
			<div className="about-mac-lights">
				<button ref={closeButton} type="button" className="close" aria-label="닫기" onClick={closeAbout} />
				<span className="off" aria-hidden="true" />
				<span className="off" aria-hidden="true" />
			</div>

			{photo ? (
				<img className="about-mac-photo" src={PHOTO} alt="" draggable={false} onError={() => setPhoto(false)} />
			) : (
				<span className="about-mac-photo monogram" aria-hidden="true">
					{PROFILE.name.slice(-2)}
				</span>
			)}
			<h2>{PROFILE.name}</h2>
			<p className="about-mac-subtitle">{PROFILE.nameEn}</p>

			<dl className="about-mac-specs">
				{ROWS.map(({ label, value, href }) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>
							{href ? (
								<a
									href={href}
									onClick={(event) => {
										if (href.startsWith('mailto:')) return;
										event.preventDefault();
										openExternal(href);
									}}
								>
									{value}
								</a>
							) : (
								value
							)}
						</dd>
					</div>
				))}
			</dl>

			<button
				type="button"
				className="about-mac-more"
				onClick={() => {
					closeAbout();
					openApp('safari');
				}}
			>
				추가 정보…
			</button>
			<p className="about-mac-legal">
				™ &amp; © {new Date().getFullYear()} {PROFILE.nameEn}. 모든 권리 보유.
			</p>
		</div>
	);
};

export default AboutThisMac;
