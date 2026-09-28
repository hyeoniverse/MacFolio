import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import './index.css';
import App from './App';
import { initSettings } from '@/shared/settings/settingsStore';

initSettings();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
