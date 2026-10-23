import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { foregroundApp, runningByRecency } from '@macfolio/desktop-core';
import { useLaunchApp } from '@/desktop/useLaunchApp';
import MobileHome from '@/desktop/mobile/MobileHome';
import MobileStatusBar from '@/desktop/mobile/MobileStatusBar';
import ControlCenter from '@/desktop/mobile/ControlCenter';
import { closeSwitcher, useSwitcherOpen } from '@/desktop/mobile/switcherStore';
import { PULL_OPEN_PX } from '@/desktop/mobile/swipe';
import { useVerticalSwipe } from '@/desktop/mobile/useVerticalSwipe';
import { CLOCK_SIDE, ICONS_SIDE, useStatusBarFill, useStatusBarTone } from '@/desktop/mobile/statusBarTone';
import { useImmersiveApp } from '@/desktop/mobile/immersiveStore';
import { useResolvedTheme } from '@/shared/settings/settingsStore';
import '@/desktop/mobile/MobileShell.css';

/**
 * 모바일 셸: 홈 화면, 그 위의 상태 표시줄, 화면 어디서든 아래로 쓸면 나오는 제어 센터.
 * 앱 창(AppWindow 모바일 모드)은 Desktop이 따로 그리고, 상태 표시줄은 앱보다 위에 있다.
 */
const MobileShell = () => {
	const { apps, goHome } = useAppState();
	const switcherOpen = useSwitcherOpen();
	const { launch } = useLaunchApp();
	const [controlCenterOpen, setControlCenterOpen] = useState(false);
	const [pull, setPull] = useState<number | null>(null);

	const closeControlCenter = useCallback(() => setControlCenterOpen(false), []);

	const foreground = foregroundApp(apps);
	const onApp = foreground !== null && !controlCenterOpen && !switcherOpen;
	// 상태 표시줄 글자 색: 그 밑에 실제로 그려진 화면(앱, 홈 화면의 배경화면)을 읽어 정한다 (iOS처럼).
	// 읽을 수 없으면 앱 위에서는 화면 모드를, 홈 화면에서는 흰 글자를 쓴다
	const statusBar = useRef<HTMLDivElement>(null);
	const dark = useResolvedTheme() === 'dark';
	// 화면만 보기 중인 앱 위에서는 상태 표시줄을 숨긴다 (사진만 보기)
	const immersive = useImmersiveApp();
	const hidden = onApp && immersive !== null && immersive === foreground;
	// 시계 쪽과 아이콘 쪽은 따로 읽는다 (배경화면은 왼쪽과 오른쪽 밝기가 크게 다를 수 있다)
	const fallbackTone = onApp && !dark ? 'dark' : 'light';
	const toneKey = `${foreground}:${dark}:${onApp}:${controlCenterOpen}:${switcherOpen}`;
	const clockTone = useStatusBarTone(statusBar, true, fallbackTone, toneKey, CLOCK_SIDE);
	const iconsTone = useStatusBarTone(statusBar, true, fallbackTone, toneKey, ICONS_SIDE);
	// 앱 화면은 상태 표시줄 아래에서 시작한다. 상태 표시줄 자리는 앱 화면 맨 윗줄의 색으로 칠한다
	useStatusBarFill(statusBar, onApp && !hidden ? foreground : null, toneKey);

	// Esc는 위에 열린 것부터 닫는다: 제어 센터, 앱 전환기 (그 아래 앱의 뒤로 가기가 이 Esc를 받지 않게 preventDefault)
	useEffect(() => {
		if (!controlCenterOpen && !switcherOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			if (controlCenterOpen) setControlCenterOpen(false);
			else closeSwitcher(foregroundApp(apps));
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [controlCenterOpen, switcherOpen, apps]);

	// 화면 어디서든 아래로 쓸면 제어 센터가 손가락을 따라 내려온다 (스크롤할 내용이 위에 남았으면 스크롤이 먼저)
	useVerticalSwipe({
		enabled: !controlCenterOpen && !switcherOpen,
		direction: 'down',
		onMove: setPull,
		onEnd: (distance) => {
			setPull(null);
			if (distance >= PULL_OPEN_PX) setControlCenterOpen(true);
		},
		onCancel: () => setPull(null),
	});

	return (
		<>
			<MobileHome launch={launch} />
			<MobileStatusBar
				ref={statusBar}
				tone={{ clock: clockTone, icons: iconsTone }}
				onApp={onApp}
				hidden={hidden}
				onOpen={() => setControlCenterOpen(true)}
			/>
			{switcherOpen && (
				// 카드 사이의 빈 곳을 누르면 홈으로
				<div
					className="app-switcher"
					role="dialog"
					aria-label="앱 전환기"
					onClick={() => {
						goHome();
						closeSwitcher();
					}}
				>
					{runningByRecency(apps).length === 0 && <p>실행 중인 앱이 없습니다</p>}
				</div>
			)}
			<ControlCenter open={controlCenterOpen} pull={pull} onClose={closeControlCenter} onLaunch={launch} />
		</>
	);
};

export default MobileShell;
