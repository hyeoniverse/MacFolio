import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { settingsStore, useSettings } from '@/shared/settings/settingsStore';
import { IOS_WALLPAPERS, MAC_WALLPAPERS, type ThemePreference } from '@/shared/settings/settings';
import WallpaperGroup from '@/apps/settings/WallpaperGroup';
import AdminAccount from '@/shared/auth/AdminAccount';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import '@/apps/settings/Settings.css';

type Section = 'account' | 'appearance' | 'wallpaper' | 'sound';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
	{ id: 'account', label: '계정', icon: 'fa-solid fa-circle-user' },
	{ id: 'appearance', label: '화면 모드', icon: 'fa-solid fa-circle-half-stroke' },
	{ id: 'wallpaper', label: '배경화면', icon: 'fa-solid fa-image' },
	{ id: 'sound', label: '사운드', icon: 'fa-solid fa-volume-high' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: 'light', label: '라이트' },
	{ value: 'dark', label: '다크' },
	{ value: 'system', label: '자동' },
];

const Settings: React.FC = () => {
	const settings = useSettings();
	const isMobile = useIsMobile();
	const [section, setSection] = useState<Section>('account');
	/** 휴대폰: iOS 설정처럼 항목 목록 → 누르면 그 항목 화면 (넓은 창에서는 쓰지 않는다) */
	const [phoneOpen, setPhoneOpen] = useState(false);

	return (
		<AppWindow title="시스템 설정" appName="settings">
			<MobileNavigation floating {...(phoneOpen ? { backLabel: '설정', onBack: () => setPhoneOpen(false) } : {})} />
			<div className="settings-shell">
				<div className={`settings ${phoneOpen ? 'phone-open' : ''}`}>
					<nav className="settings-sidebar" aria-label="설정 항목">
						<h2 className="settings-phone-title phone-title">설정</h2>
						{SECTIONS.map((item) => (
							<button
								key={item.id}
								type="button"
								className={`settings-nav-item ${section === item.id ? 'active' : ''}`}
								aria-current={section === item.id ? 'page' : undefined}
								onClick={() => {
									setSection(item.id);
									setPhoneOpen(true);
								}}
							>
								<i className={item.icon} aria-hidden="true" />
								{item.label}
								<i className="fa-solid fa-chevron-right settings-nav-chevron" aria-hidden="true" />
							</button>
						))}
					</nav>

					<section key={section} className="settings-panel">
						{section === 'account' && (
							<>
								<h2 className="phone-title">계정</h2>
								<AdminAccount />
							</>
						)}

						{section === 'appearance' && (
							<>
								<h2 className="phone-title">화면 모드</h2>
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
								<h2 className="phone-title">배경화면</h2>
								{/* 화면마다 자기 배경화면만 (데스크톱은 macOS, 휴대폰은 iOS). 더한 배경화면은 양쪽에 다 보인다 */}
								{isMobile ? (
									<WallpaperGroup
										kind="ios"
										label="iOS"
										hint="휴대폰 홈 화면 배경화면."
										wallpapers={IOS_WALLPAPERS}
										selected={settings.mobileWallpaper}
									/>
								) : (
									<WallpaperGroup
										kind="mac"
										label="macOS"
										hint="데스크톱 배경화면. 기본 배경화면은 다크 모드에서 어두운 버전으로 바뀝니다."
										wallpapers={MAC_WALLPAPERS}
										selected={settings.wallpaper}
									/>
								)}
							</>
						)}

						{section === 'sound' && (
							<>
								<h2 className="phone-title">사운드</h2>
								<label className="settings-toggle">
									<span>
										<strong>클릭 소리</strong>
										<span className="settings-hint">마우스를 누르고 뗄 때 딸깍 소리를 냅니다.</span>
									</span>
									<input
										type="checkbox"
										role="switch"
										checked={settings.clickSound}
										onChange={(event) => settingsStore.setState({ clickSound: event.target.checked })}
									/>
								</label>
							</>
						)}
					</section>
				</div>
			</div>
		</AppWindow>
	);
};

export default Settings;
