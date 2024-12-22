import { AppStateProvider } from '../contexts/AppContext';
import { MusicProvider } from '../contexts/MusicContext';
import { MemoProvider } from '../contexts/MemoContext';

import StatusBar from '../components/common/StatusBar';
import Dock from '../components/common/Dock';

import Safari from '../components/apps/Safari';
import MusicPlayer from '../components/apps/MusicPlayer';
import Memo from '../components/apps/Memo';
import Github from '../components/apps/Github';
import Blog from '../components/apps/Blog';
import Mail from '../components/apps/Mail';

const DesktopPage = () => {
  return (
    <div style={{ display: 'flex' }}>
    <AppStateProvider><MusicProvider>
      <div className="App">
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
      </div>
    </MusicProvider></AppStateProvider>
    </div>
  );
};

export default DesktopPage;