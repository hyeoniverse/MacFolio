import { AppStateProvider } from '@/desktop/AppStateContext';
import { MusicProvider } from '@/apps/music/MusicContext';
import { WINDOW_APPS } from '@/apps/registry';

import StatusBar from '@/desktop/status-bar/StatusBar';
import Dock from '@/desktop/dock/Dock';

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
					{WINDOW_APPS.map(({ name, Component }) => (
						<Component key={name} />
					))}
					<Dock />
				</MusicProvider>
			</AppStateProvider>
		</div>
	);
};

export default Desktop;
