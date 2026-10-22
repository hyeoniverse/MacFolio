import React, { Suspense } from 'react';
import AboutThisMac from '@/desktop/about/AboutThisMac';
import { AppStateProvider } from '@/desktop/AppStateContext';
import { useAppState } from '@/desktop/useAppState';
import { MusicProvider } from '@/apps/music/MusicContext';
import { WINDOW_APPS } from '@/apps/registry';
import AppErrorBoundary from '@/desktop/window/AppErrorBoundary';

import StatusBar from '@/desktop/status-bar/StatusBar';
import Dock from '@/desktop/dock/Dock';
import DesktopIcons from '@/desktop/icons/DesktopIcons';
import DesktopWidgets from '@/desktop/widgets/DesktopWidgets';
import MobileShell from '@/desktop/mobile/MobileShell';
import WallpaperVideo from '@/desktop/WallpaperVideo';
import Notifications from '@/desktop/notifications/Notifications';
// 창 틀·홈 인디케이터 같은 셸의 모양. 창(Window.tsx)은 앱이 처음 열릴 때 불러오지만(apps/registry.ts),
// 홈 화면의 홈 인디케이터·앱 전환기도 이 CSS를 쓰므로 셸이 처음부터 싣는다
import '@/desktop/window/Window.css';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

/**
 * 한 번이라도 열린 앱만 렌더링한다. 처음 열 때 지연 로딩 앱의 코드를 불러오고,
 * 그 뒤로는 닫혀도 마운트된 채 두어 상태(창 위치, 입력 중인 글 등)를 유지한다.
 */
const OpenedApps = () => {
	const { apps } = useAppState();
	return WINDOW_APPS.filter(({ name }) => apps[name].hasOpened).map(({ name, Component }) => (
		<AppErrorBoundary key={name} appName={name}>
			<Suspense fallback={null}>
				<Component />
			</Suspense>
		</AppErrorBoundary>
	));
};

/**
 * 창 밖(바탕화면·Dock·Launchpad)을 누르면 메뉴 막대의 앱 이름이 Finder로 돌아간다. 메뉴 막대는 예외다.
 * 이 상자가 먼저(캡처) 바탕화면을 앞으로 하고, 창 안을 누른 것이면 창이 바로 이어서(캡처) 자기 앱을 앞으로 한다.
 * React 이벤트는 React 트리를 따라가므로, 창이 포털로 띄운 메뉴를 눌러도 그 창의 앱으로 남는다
 */
const DesktopSurface = ({ children }: { children: React.ReactNode }) => {
	const { focusDesktop } = useAppState();
	return (
		// 화면 전체를 덮는 바탕화면 판: 창이 없는 곳을 눌러도 여기에 닿는다
		<div
			className="desktop-surface"
			onPointerDownCapture={(event) => {
				// 메뉴 막대와 거기서 연 메뉴·창(Apple 메뉴, 파일·보기…, 서버 상태, 음량, 키보드 단축키)은 눌러도 지금 쓰는 앱이 그대로다.
				// 메뉴는 body에 그려지므로(포털) .ui-menu로 본다. 창이 연 메뉴는 이어서 창이 자기 앱을 앞으로 한다.
				// Dock·Launchpad도 누르는 동안은 그대로다: 앱은 클릭이 끝나야 바뀐다 (누르자마자 Finder가 되면 앱 이름이 깜빡인다)
				if (
					(event.target as Element).closest?.(
						'.macos-statusbar, .ui-menu, .volume-container, .keyboard-shortcuts-overlay, .dock, .launchpad-content'
					)
				)
					return;
				focusDesktop();
			}}
		>
			{children}
		</div>
	);
};

const Desktop = () => {
	// 좁은 화면에서는 macOS 메뉴 막대·Dock 대신 iOS 홈 화면을 보여준다. 앱 창은 같은 컴포넌트를 쓴다.
	const isMobile = useIsMobile();

	return (
		<div className="App">
			<AppStateProvider>
				{/* StatusBar의 볼륨 조절도 음악 상태를 쓰므로 MusicProvider는 전역에 둔다 */}
				<MusicProvider>
					{isMobile ? (
						<>
							<MobileShell />
							<OpenedApps />
						</>
					) : (
						<DesktopSurface>
							{/* 동영상 배경화면 (고른 배경화면이 MP4일 때만) */}
							<WallpaperVideo kind="mac" />
							{/* 바탕화면 아이콘은 가장 아래 층: 창·Dock·메뉴 막대가 덮는다 */}
							<DesktopIcons />
							{/* 위젯은 아이콘 위, 창 아래 */}
							<DesktopWidgets />
							<StatusBar />
							<OpenedApps />
							<Dock />
							<AboutThisMac />
						</DesktopSurface>
					)}
					<Notifications />
				</MusicProvider>
			</AppStateProvider>
		</div>
	);
};

export default Desktop;
