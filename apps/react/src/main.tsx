import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import './styles/motion.css';
import './index.css';
import App from './App';
import { initSettings } from '@/shared/settings/settingsStore';
import { initAdmin } from '@/shared/auth/adminStore';

initSettings();
// GitHub에서 돌아왔으면 결과를 알리고, 관리자로 로그인했는지 확인한다
void initAdmin();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
