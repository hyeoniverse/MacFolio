import ReactDOM from 'react-dom/client';
import './styles/layers.css';
import './styles/theme.css';
import './styles/motion.css';
import './index.css';
import App from './App';
import { initSettings } from '@/shared/settings/settingsStore';
import { initAdmin } from '@/shared/auth/adminStore';
import { initClickSound } from '@/shared/sound/clickSound';
import { checkChosenWallpapers } from '@/shared/settings/customWallpapers';
import { startAnalytics } from '@/shared/analytics/analytics';

initSettings();
// 관리자가 더한 배경화면을 골라 뒀으면, 그 배경화면이 아직 있는지 확인한다
checkChosenWallpapers();
initClickSound();
// GitHub에서 돌아왔으면 결과를 알리고, 관리자로 로그인했는지 확인한다
void initAdmin();
// 트래픽 분석: 페이지 열기와 앱·글·링크를 모아 보낸다 (쿠키 없음, docs/privacy.md)
startAnalytics();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
