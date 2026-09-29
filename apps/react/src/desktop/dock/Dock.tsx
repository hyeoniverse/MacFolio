import React, { useState } from 'react';
import DockItem from '@/desktop/dock/DockItem';
import '@/desktop/dock/Dock.css';
import { useLaunchApp } from '@/desktop/useLaunchApp';

import { env } from '@/shared/config/env';
import { APP_MANIFEST, DOCK_APPS, type AppName } from '@/apps/manifest';
import { useViewport } from '@/shared/hooks/useViewport';

const imgUrl = env.imageUrl;
const iconOf = (appName: AppName) => `${imgUrl}/${APP_MANIFEST[appName].icon}`;

const Dock: React.FC = () => {
	const { launch: handleAppOpen, isActive } = useLaunchApp();
	const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false); // 모달 상태 관리

	// Dock에 다 들어가지 않는 앱은 Launchpad로 보낸다 (아이콘 하나당 100px, 양옆 여백 300px)
	const { width } = useViewport();
	const maxItems = Math.floor((width - 300) / 100);
	const hiddenItems: AppName[] = DOCK_APPS.length > maxItems ? DOCK_APPS.slice(maxItems) : [];

	const handleLaunchpadClick = () => {
		if (hiddenItems.length > 0) {
			setIsLaunchpadOpen(!isLaunchpadOpen); // 숨겨진 앱이 있을 때만 Launchpad 모달 열고 닫기
		} else {
			setIsLaunchpadOpen(false); // 숨겨진 앱이 없으면 모달을 닫음
		}
	};

	const closeLaunchpad = () => {
		setIsLaunchpadOpen(false); // 모달 닫기
	};

	// 모달 외부 클릭 시 모달을 닫음
	const handleOutsideClick = (e: React.MouseEvent) => {
		const target = e.target as Element;
		if (target.classList.contains('launchpad-modal')) {
			closeLaunchpad();
		}
	};

	return (
		<div>
			<div className="dock">
				<div className="dock-left">
					{DOCK_APPS.map(
						(appName) =>
							!hiddenItems.includes(appName) && (
								<DockItem
									key={appName}
									label={appName}
									icon={iconOf(appName)}
									isActive={isActive(appName)}
									isHidden={hiddenItems.includes(appName)}
									onClick={() => handleAppOpen(appName)}
									disableRadius={APP_MANIFEST[appName].squareIcon}
								/>
							)
					)}
				</div>
				<div className="dock-left-end">
					<DockItem
						label="launchpad"
						icon={`${imgUrl}/launchpad.png`}
						isActive={false} // Launchpad 열렸을 때만 인디케이터 활성화
						isHidden={false}
						onClick={handleLaunchpadClick} // Launchpad 클릭 시 모달 열기
					/>
				</div>
				<div className="dock-right">
					<DockItem
						label="bin"
						icon={iconOf('bin')}
						isActive={false}
						isHidden={false}
						onClick={() => {}} // 휴지통은 아직 동작 없음
					/>
				</div>
			</div>

			{/* Launchpad 모달 */}
			{isLaunchpadOpen && hiddenItems.length > 0 && (
				<div className="launchpad-modal" onClick={handleOutsideClick}>
					<div className="launchpad-content">
						<div className="hidden-apps">
							{hiddenItems.map((hiddenItem) => (
								<DockItem
									key={hiddenItem}
									label={hiddenItem}
									icon={iconOf(hiddenItem)}
									isActive={isActive(hiddenItem)}
									isHidden={false}
									onClick={() => {
										// 앱을 열면 Launchpad는 닫힌다
										closeLaunchpad();
										handleAppOpen(hiddenItem);
									}}
									disableRadius={APP_MANIFEST[hiddenItem].squareIcon}
								/>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Dock;
