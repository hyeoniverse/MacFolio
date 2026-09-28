import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { settingsStore, useSettings } from '@/shared/settings/settingsStore';
import { WALLPAPERS, type ThemePreference } from '@/shared/settings/settings';
import '@/apps/settings/Settings.css';

type Section = 'appearance' | 'wallpaper';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
	{ id: 'appearance', label: '화면 모드', icon: 'fa-solid fa-circle-half-stroke' },
	{ id: 'wallpaper', label: '배경화면', icon: 'fa-solid fa-image' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: 'light', label: '라이트' },
	{ value: 'dark', label: '다크' },
	{ value: 'system', label: '자동' },
];

const Settings: React.FC = () => {
	const settings = useSettings();
	const [section, setSection] = useState<Section>('appearance');

	return (
		<AppWindow title="시스템 설정" appName="settings">
			<div className="settings">
				<nav className="settings-sidebar" aria-label="설정 항목">
					{SECTIONS.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`settings-nav-item ${section === item.id ? 'active' : ''}`}
							aria-current={section === item.id ? 'page' : undefined}
							onClick={() => setSection(item.id)}
						>
							<i className={item.icon} aria-hidden="true" />
							{item.label}
						</button>
					))}
				</nav>

				<section className="settings-panel">
					{section === 'appearance' && (
						<>
							<h2>화면 모드</h2>
							<div className="settings-options" role="radiogroup" aria-label="화면 모드">
								{THEME_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										role="radio"
										aria-checked={settings.theme === option.value}
										className={`theme-option ${settings.theme === option.value ? 'selected' : ''}`}
										onClick={() => settingsStore.setState({ theme: option.value })}
									>
										<span className={`theme-preview theme-preview-${option.value}`} aria-hidden="true" />
										{option.label}
									</button>
								))}
							</div>
							<p className="settings-hint">자동을 고르면 기기의 화면 모드 설정을 따릅니다.</p>
						</>
					)}

					{section === 'wallpaper' && (
						<>
							<h2>배경화면</h2>
							<div className="settings-options wallpaper-grid" role="radiogroup" aria-label="배경화면">
								{WALLPAPERS.map((wallpaper) => (
									<button
										key={wallpaper.id}
										type="button"
										role="radio"
										aria-checked={settings.wallpaper === wallpaper.id}
										className={`wallpaper-option ${settings.wallpaper === wallpaper.id ? 'selected' : ''}`}
										onClick={() => settingsStore.setState({ wallpaper: wallpaper.id })}
									>
										<span
											className="wallpaper-thumbnail"
											style={{ backgroundImage: wallpaper.css }}
											aria-hidden="true"
										/>
										{wallpaper.name}
									</button>
								))}
							</div>
						</>
					)}
				</section>
			</div>
		</AppWindow>
	);
};

export default Settings;
