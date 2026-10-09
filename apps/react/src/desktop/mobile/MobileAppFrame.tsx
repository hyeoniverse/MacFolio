import { cssVars } from '@/shared/lib/cssVars';
import React, { useEffect, useRef, useState } from 'react';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import { foregroundApp } from '@macfolio/desktop-core';
import HomeIndicator from '@/desktop/mobile/HomeIndicator';
import { closeSwitcher, getSwitcherScroll, openSwitcher, setSwitcherScroll } from '@/desktop/mobile/switcherStore';
import { MobileNavContext, type MobileNav } from '@/desktop/window/mobileNav';
import { env } from '@/shared/config/env';
import { clearImmersiveApp, setImmersiveApp } from '@/desktop/mobile/immersiveStore';

/** 카드를 위로 이만큼 밀면 앱을 닫는다 */
const SWIPE_CLOSE_PX = 120;
/** 이보다 적게 움직이면 누른 것으로 본다 */
const TAP_PX = 8;

interface Props {
	appName: AppName;
	title: string;
	chrome: 'titlebar' | 'unified';
	zIndex: number;
	frameRef: React.RefObject<HTMLDivElement | null>;
	/** 앱 전환기 안의 카드로 보일 때 몇 번째 카드인지. 아니면 null */
	cardIndex: number | null;
	/** 전환기의 카드 수 (옆으로 끄는 범위) */
	cardCount: number;
	onHome: () => void;
	onClick?: () => void;
	children: React.ReactNode;
}

/** 글자를 쓰는 곳 (그 안의 Esc는 쓰기를 위한 것이다) */
const isEditable = (target: EventTarget | null) =>
	target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]') !== null;

/**
 * 모바일 앱 화면. 평소에는 화면을 가득 채우고, 앱 전환기가 열리면 작아져 카드가 된다.
 * 카드는 실제 앱 화면 그대로다 (스크린샷이 아니다). 누르면 그 앱으로, 위로 밀면 앱을 닫는다.
 */
const MobileAppFrame: React.FC<Props> = ({
	appName,
	title,
	chrome,
	zIndex,
	frameRef,
	cardIndex,
	cardCount,
	onHome,
	onClick,
	children,
}) => {
	const { apps, bringAppToFront, quitApp } = useAppState();
	const [nav, setNav] = useState<MobileNav | null>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const gesture = useRef<{ x: number; y: number; scroll: number; axis: 'x' | 'y' | null } | null>(null);
	const inSwitcher = cardIndex !== null;
	const back = nav?.onBack ?? onHome;
	const backRef = useRef(back);
	useEffect(() => {
		backRef.current = back;
	});

	// Esc는 떠 있는 뒤로 가기와 같다 (맨 앞 앱만). 앱 안의 팝오버·대화상자·쓰기 화면이 먼저다:
	// 그들이 이 Esc를 썼으면(preventDefault) 뒤로 가지 않는다. 듣는 순서와 상관없게 이벤트가 다 돈 뒤에 본다
	const foreground = !inSwitcher && foregroundApp(apps) === appName;

	// 화면만 보기: 맨 앞에 있는 동안 상태 표시줄도 숨긴다 (MobileShell이 읽는다)
	const immersive = foreground && !!nav?.immersive;
	useEffect(() => {
		if (!immersive) return;
		setImmersiveApp(appName);
		return () => clearImmersiveApp(appName);
	}, [immersive, appName]);
	useEffect(() => {
		if (!foreground) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented || isEditable(event.target)) return;
			setTimeout(() => {
				if (!event.defaultPrevented) backRef.current();
			}, 0);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [foreground]);
	const { label, icon } = APP_MANIFEST[appName].mobile ?? APP_MANIFEST[appName];

	// 홈 인디케이터를 쓸어 올리는 동안 앱 화면이 손가락을 따라 작아진다
	const followDrag = (distance: number | null) => {
		const frame = frameRef.current;
		if (!frame) return;
		frame.style.transform =
			distance === null ? '' : `translateY(${-distance * 0.35}px) scale(${1 - Math.min(distance, 320) / 900})`;
		frame.style.borderRadius = distance === null ? '' : '36px';
	};

	const cardHandlers: React.HTMLAttributes<HTMLDivElement> = {
		onPointerDown: (event) => {
			gesture.current = { x: event.clientX, y: event.clientY, scroll: getSwitcherScroll(), axis: null };
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		onPointerMove: (event) => {
			const g = gesture.current;
			if (!g) return;
			const dx = event.clientX - g.x;
			const dy = event.clientY - g.y;
			if (!g.axis && Math.hypot(dx, dy) > TAP_PX) g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
			if (g.axis === 'x') {
				// 옆으로 끌면 카드 줄이 움직인다 (첫 카드와 마지막 카드 밖으로는 조금만)
				const step = window.innerWidth * 0.66;
				const min = -(cardCount - 1) * step;
				const next = g.scroll + dx;
				const clamped = next > 0 ? next * 0.3 : next < min ? min + (next - min) * 0.3 : next;
				document.documentElement.classList.add('switcher-dragging');
				setSwitcherScroll(clamped);
			}
			if (g.axis === 'y' && cardRef.current) cardRef.current.style.setProperty('--card-lift', `${Math.min(0, dy)}px`);
		},
		onPointerUp: (event) => {
			const g = gesture.current;
			gesture.current = null;
			document.documentElement.classList.remove('switcher-dragging');
			if (!g) return;
			const card = cardRef.current;
			if (g.axis === 'x') {
				// 가장 가까운 카드에 맞춘다
				const step = window.innerWidth * 0.66;
				const index = Math.min(cardCount - 1, Math.max(0, Math.round(-getSwitcherScroll() / step)));
				setSwitcherScroll(-index * step);
			} else if (g.axis === 'y') {
				if (g.y - event.clientY >= SWIPE_CLOSE_PX) {
					// 위로 밀어 올려 앱을 완전히 끈다 (음악이면 재생도 멈춘다)
					card?.style.setProperty('--card-lift', '-110vh');
					setTimeout(() => quitApp(appName), 250);
				} else card?.style.setProperty('--card-lift', '0px');
			} else {
				// 카드를 누르면 그 앱으로 돌아간다
				bringAppToFront(appName);
				closeSwitcher(appName);
			}
		},
		onPointerCancel: () => {
			gesture.current = null;
			document.documentElement.classList.remove('switcher-dragging');
			cardRef.current?.style.setProperty('--card-lift', '0px');
		},
	};

	return (
		<div
			ref={cardRef}
			className={`mobile-app-frame ${inSwitcher ? 'in-switcher' : ''}`}
			style={{ zIndex: inSwitcher ? 1500 - cardIndex : zIndex, ...cssVars({ 'card-index': cardIndex ?? 0 }) }}
			{...(inSwitcher ? cardHandlers : {})}
			aria-label={inSwitcher ? `${label} 열기` : undefined}
			role={inSwitcher ? 'button' : undefined}
		>
			{inSwitcher && (
				<div className="switcher-label" aria-hidden="true">
					<img src={`${env.imageUrl}/${icon}`} alt="" />
					{label}
				</div>
			)}
			<div
				ref={frameRef}
				data-app={appName}
				aria-label={title}
				className={`container mobile ${chrome === 'unified' ? 'unified' : ''}`}
				onClick={onClick}
				// 전환기 안에서는 앱을 누를 수 없고 카드 전체가 버튼이다
				inert={inSwitcher}
			>
				{/* iOS처럼 제목 막대가 없다: 뒤로 가기는 내용 위에 떠 있는 동그란 단추 하나 (첫 화면은 홈, 안으로 들어가면 앱이 정한 뒤로 가기).
				    내용은 상태 표시줄 아래부터 화면 끝까지 쓰고, 홈 바도 내용 위에 떠 있다 */}
				{/* 홈으로 가는 단추를 감춘 앱(hideHome)은 앱이 정한 뒤로 가기가 있을 때만 그린다 */}
				{(nav?.onBack || !nav?.hideHome) && (
					<div
						className={`mobile-navbar ${nav?.placement === 'bottom' ? 'bottom' : ''} ${nav?.immersive ? 'hidden' : ''}`}
					>
						<button type="button" className="mobile-navbar-home" onClick={nav?.onBack ?? onHome}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
							<span className="mobile-navbar-back-label">{nav?.backLabel ?? '홈'}</span>
						</button>
					</div>
				)}
				<div className="content">
					<MobileNavContext.Provider value={setNav}>{children}</MobileNavContext.Provider>
				</div>
				<HomeIndicator
					onHome={onHome}
					onDrag={followDrag}
					onSwitcher={() => {
						followDrag(null);
						openSwitcher();
					}}
				/>
			</div>
		</div>
	);
};

export default MobileAppFrame;
