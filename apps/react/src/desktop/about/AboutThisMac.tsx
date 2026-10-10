import { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { requestFinderDoc } from '@/apps/finder/openDoc';
import { requestedSection } from '@/apps/settings/settingsRequest';
import { photoUrl, useProfile } from '@/shared/site/profileStore';
import { profileRows } from './profileInfo';
import ProfileLink from './ProfileLink';
import { closeAbout, useAboutOpen } from './aboutStore';
import './AboutThisMac.css';

/**
 * Apple 메뉴의 '이 Mac에 관하여': macOS의 같은 창처럼 가운데 작은 창에 그림, 이름, 사양 줄, '추가 정보…'.
 * 이 Mac 대신 만든 사람(사이트 주인)의 프로필을 보여 준다. '추가 정보…'는 macOS처럼 시스템 설정의 '정보'를 연다. 앱이 아니라 시스템 창이라 Dock·Finder에는 없다.
 * 창의 빈 곳을 잡아 옮기고, 닫기 단추나 Esc로 닫는다 (최소화·확대는 macOS처럼 꺼져 있다)
 */
const AboutThisMac = () => {
	const open = useAboutOpen();
	const { openApp } = useAppState();
	const profile = useProfile();
	const photo = photoUrl(profile);
	/** 불러오지 못한 사진 주소 (프로필의 GitHub 주소가 바뀌면 다시 시도한다) */
	const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
	/** 가운데에서 옮긴 만큼 */
	const [offset, setOffset] = useState({ x: 0, y: 0 });
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

			{brokenPhoto !== photo ? (
				<img className="about-mac-photo" src={photo} alt="" draggable={false} onError={() => setBrokenPhoto(photo)} />
			) : (
				<span className="about-mac-photo monogram" aria-hidden="true">
					{profile.name.slice(-2)}
				</span>
			)}
			<h2>{profile.name}</h2>
			{profile.nameEn && <p className="about-mac-subtitle">{profile.nameEn}</p>}

			<dl className="about-mac-specs">
				{profileRows(profile).map(({ label, value, href }) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>{href ? <ProfileLink href={href}>{value}</ProfileLink> : value}</dd>
					</div>
				))}
			</dl>

			<button
				type="button"
				className="about-mac-more"
				onClick={() => {
					// macOS처럼 시스템 설정의 정보로 (만든 사람의 기술 전부, 이 사이트를 만든 기술)
					requestedSection.setState({ section: 'about' });
					closeAbout();
					openApp('settings');
				}}
			>
				추가 정보…
			</button>
			{/* macOS에서 이 자리는 '규제 인증서'. 이 사이트에서 그에 맞는 문서는 개인정보 처리 방침이다 (Apple 메뉴와 같은 문서) */}
			<button
				type="button"
				className="about-mac-link"
				onClick={() => {
					closeAbout();
					requestFinderDoc('docs/privacy.md');
					openApp('finder');
				}}
			>
				개인정보 처리 방침
			</button>
			<p className="about-mac-legal">
				™ &amp; © {new Date().getFullYear()} {profile.nameEn || profile.name}. 모든 권리 보유.
			</p>
		</div>
	);
};

export default AboutThisMac;
