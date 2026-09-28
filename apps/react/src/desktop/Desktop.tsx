import { Suspense } from 'react';
import { AppStateProvider, useAppState } from '@/desktop/AppStateContext';
import { MusicProvider } from '@/apps/music/MusicContext';
import { WINDOW_APPS } from '@/apps/registry';
import AppErrorBoundary from '@/desktop/window/AppErrorBoundary';

import StatusBar from '@/desktop/status-bar/StatusBar';
import Dock from '@/desktop/dock/Dock';

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

const Desktop = () => {
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
					<StatusBar />
					<OpenedApps />
					<Dock />
				</MusicProvider>
			</AppStateProvider>
		</div>
	);
};

export default Desktop;
