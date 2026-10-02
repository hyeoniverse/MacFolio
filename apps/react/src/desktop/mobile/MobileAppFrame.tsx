import React, { useRef, useState } from 'react';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/AppStateContext';
import HomeIndicator from '@/desktop/mobile/HomeIndicator';
import { closeSwitcher, getSwitcherScroll, openSwitcher, setSwitcherScroll } from '@/desktop/mobile/switcherStore';
import { MobileNavContext, type MobileNav } from '@/desktop/window/mobileNav';
import { env } from '@/shared/config/env';

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
	appStyle?: React.CSSProperties;
	contentStyle?: React.CSSProperties;
	titleBarStyle?: React.CSSProperties;
	children: React.ReactNode;
}

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
	appStyle,
	contentStyle,
	titleBarStyle,
	children,
}) => {
	const { bringAppToFront, quitApp } = useAppState();
	const [nav, setNav] = useState<MobileNav | null>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const gesture = useRef<{ x: number; y: number; scroll: number; axis: 'x' | 'y' | null } | null>(null);
	const inSwitcher = cardIndex !== null;
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
			style={{ zIndex: inSwitcher ? 1500 - cardIndex : zIndex, ['--card-index' as string]: cardIndex ?? 0 }}
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
				className={`container mobile ${chrome === 'unified' ? 'unified' : ''} ${nav?.floating ? 'nav-floating' : ''}`}
				style={appStyle}
				onClick={onClick}
				// 전환기 안에서는 앱을 누를 수 없고 카드 전체가 버튼이다
				inert={inSwitcher}
			>
				{/* iOS 제목 막대: 모든 앱에 같은 모양. 왼쪽 버튼은 첫 화면에서는 홈, 앱 안으로 들어가면 앱이 정한 뒤로 가기 */}
				{/* floating이면 제목 막대 없이 뒤로 가기만 본문 위에 동그랗게 뜬다 (iOS 메모 본문) */}
				<div className={`mobile-navbar ${nav?.floating ? 'floating' : ''}`} style={titleBarStyle}>
					<button type="button" className="mobile-navbar-home" onClick={nav?.onBack ?? onHome}>
						<i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
						<span className="mobile-navbar-back-label">{nav?.backLabel ?? '홈'}</span>
					</button>
					<span className="title">{nav?.title ?? title}</span>
				</div>
				<div className="content" style={contentStyle}>
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
