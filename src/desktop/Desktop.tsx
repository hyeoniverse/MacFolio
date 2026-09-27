import { AppStateProvider } from '@/desktop/AppStateContext';
import { MusicProvider } from '@/apps/music/MusicContext';
import { MemoProvider } from '@/apps/memo/MemoContext';

import StatusBar from '@/desktop/status-bar/StatusBar';
import Dock from '@/desktop/dock/Dock';

import Safari from '@/apps/safari/Safari';
import MusicPlayer from '@/apps/music/MusicPlayer';
import Memo from '@/apps/memo/Memo';
import Github from '@/apps/github/Github';
import Blog from '@/apps/blog/Blog';
import Mail from '@/apps/mail/Mail';

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
				<MusicProvider>
					<StatusBar />
					<MusicPlayer />
					<Safari />
					<MemoProvider>
						<Memo />
					</MemoProvider>
					<Github />
					<Blog />
					<Mail />
					<Dock />
				</MusicProvider>
			</AppStateProvider>
		</div>
	);
};

export default Desktop;
