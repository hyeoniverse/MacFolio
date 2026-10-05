import React, { Suspense } from 'react';
import { AppStateProvider, useAppState } from '@/desktop/AppStateContext';
import { MusicProvider } from '@/apps/music/MusicContext';
import { WINDOW_APPS } from '@/apps/registry';
import AppErrorBoundary from '@/desktop/window/AppErrorBoundary';

import StatusBar from '@/desktop/status-bar/StatusBar';
import Dock from '@/desktop/dock/Dock';
import MobileShell from '@/desktop/mobile/MobileShell';
import Notifications from '@/desktop/notifications/Notifications';
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
 * 창 밖(바탕화면·메뉴 막대·Dock·Launchpad)을 누르면 메뉴 막대의 앱 이름이 Finder로 돌아간다.
 * 이 상자가 먼저(캡처) 바탕화면을 앞으로 하고, 창 안을 누른 것이면 창이 바로 이어서(캡처) 자기 앱을 앞으로 한다.
 * React 이벤트는 React 트리를 따라가므로, 창이 포털로 띄운 메뉴를 눌러도 그 창의 앱으로 남는다
 */
const DesktopSurface = ({ children }: { children: React.ReactNode }) => {
	const { focusDesktop } = useAppState();
	return (
		// 화면 전체를 덮는 바탕화면 판: 창이 없는 곳을 눌러도 여기에 닿는다
		<div className="desktop-surface" style={{ width: '100%', height: '100%' }} onPointerDownCapture={focusDesktop}>
			{children}
		</div>
	);
};

const Desktop = () => {
	// 좁은 화면에서는 macOS 메뉴 막대·Dock 대신 iOS 홈 화면을 보여준다. 앱 창은 같은 컴포넌트를 쓴다.
	const isMobile = useIsMobile();

	return (
		<div
			className="App"
			style={{
				width: '100vw',
				height: '100vh',
				overflow: 'hidden',
			}}
		>
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
							<StatusBar />
							<OpenedApps />
							<Dock />
						</DesktopSurface>
					)}
					<Notifications />
				</MusicProvider>
			</AppStateProvider>
		</div>
	);
};

export default Desktop;
