import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@/desktop/dock/Toast.css';
import '@/desktop/mobile/MobileHome.css';
import { APP_MANIFEST, APP_NAMES, type AppName } from '@/apps/manifest';
import { WINDOW_APPS } from '@/apps/registry';
import { useLaunchApp } from '@/desktop/useLaunchApp';
import { env } from '@/shared/config/env';
import { PROFILE } from '@/shared/profile';

/** 홈 화면 아래 Dock에 둘 앱 */
const MOBILE_DOCK: AppName[] = ['safari', 'messages', 'mail', 'music'];

// 창이 있거나 동작(링크·공유)이 있는 앱만 보여준다. 아직 화면이 없는 앱은 눌러도 아무 일이 없기 때문이다.
const launchable = (name: AppName) =>
	WINDOW_APPS.some((app) => app.name === name) || APP_MANIFEST[name].action !== undefined;

const GRID_APPS = APP_NAMES.filter((name) => launchable(name) && !MOBILE_DOCK.includes(name));

const AppIcon = ({ name, showLabel, onLaunch }: { name: AppName; showLabel: boolean; onLaunch: () => void }) => {
	const { label, icon, squareIcon } = APP_MANIFEST[name];
	return (
		<button type="button" className="mobile-app" aria-label={label} onClick={onLaunch}>
			<img src={`${env.imageUrl}/${icon}`} alt="" className={squareIcon ? 'square' : undefined} draggable={false} />
			{showLabel && <span>{label}</span>}
		</button>
	);
};

/**
 * 좁은 화면에서 데스크톱(StatusBar·Dock) 대신 보여주는 iOS 홈 화면.
 * 앱을 누르면 화면을 가득 채워 열리고(AppWindow 모바일 모드), 홈 인디케이터로 돌아온다.
 */
const MobileHome = () => {
	const { launch } = useLaunchApp();

	return (
		<div className="mobile-home">
			<ToastContainer position="top-center" autoClose={1200} hideProgressBar closeOnClick />

			<section className="mobile-widget" aria-label="소개">
				<p className="mobile-widget-eyebrow">Portfolio</p>
				<h1>{PROFILE.name}</h1>
				<p>{PROFILE.role}</p>
				<p className="mobile-widget-meta">
					<i className="fa-solid fa-location-dot" aria-hidden="true"></i> {PROFILE.location}
				</p>
			</section>

			<nav className="mobile-grid" aria-label="앱">
				{GRID_APPS.map((name) => (
					<AppIcon key={name} name={name} showLabel onLaunch={() => launch(name)} />
				))}
			</nav>

			<nav className="mobile-dock" aria-label="Dock">
				{MOBILE_DOCK.map((name) => (
					<AppIcon key={name} name={name} showLabel={false} onLaunch={() => launch(name)} />
				))}
			</nav>
		</div>
	);
};

export default MobileHome;
