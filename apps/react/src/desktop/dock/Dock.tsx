import React, { useState } from 'react';
import DockItem from '@/desktop/dock/DockItem';
import '@/desktop/dock/Dock.css';
import { useLaunchApp } from '@/desktop/useLaunchApp';

import { env } from '@/shared/config/env';
import { APP_MANIFEST, DOCK_APPS, LAUNCHPAD_APPS, visibleTo, type AppName } from '@/apps/manifest';
import { useAdmin } from '@/shared/auth/adminStore';
import { useViewport } from '@/shared/hooks/useViewport';
import {
	DOCK_DIVIDER,
	DOCK_GAP,
	DOCK_PADDING,
	dockAppCapacity,
	dockIconSize,
	dockLayout,
} from '@/desktop/dock/dockLayout';

const imgUrl = env.imageUrl;
const iconOf = (appName: AppName) => `${imgUrl}/${APP_MANIFEST[appName].icon}`;

const Dock: React.FC = () => {
	const { launch: handleAppOpen, isActive } = useLaunchApp();
	const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false); // 모달 상태 관리

	// Dock에 다 들어가지 않는 앱은 Launchpad로 보낸다. 실행 중이라 나타난 앱도 칸에 세어서 Launchpad·휴지통과 겹치지 않는다
	const { width } = useViewport();
	// 관리자 전용 앱(활동 상태 보기)은 관리자에게만 Launchpad에
	const admin = useAdmin().status === 'signed-in';
	const {
		pinned,
		running,
		launchpad: hiddenItems,
	} = dockLayout(dockAppCapacity(width), DOCK_APPS, LAUNCHPAD_APPS.filter(visibleTo(admin)), isActive);
	// 아이콘 크기와 간격은 칸 수를 센 값 그대로 CSS에 넘긴다
	const dockStyle = {
		'--dock-icon': `${dockIconSize(width)}px`,
		'--dock-gap': `${DOCK_GAP}px`,
		'--dock-padding': `${DOCK_PADDING}px`,
		'--dock-divider': `${DOCK_DIVIDER}px`,
	} as React.CSSProperties;

	const handleLaunchpadClick = () => setIsLaunchpadOpen(!isLaunchpadOpen);

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
			{/* 한 줄로 내용만큼 넓어지고 가운데에 놓인다 (macOS Dock): 앱 → Launchpad → 구분선 → 휴지통 */}
			<div className="dock" style={dockStyle}>
				{pinned.map((appName) => (
					<DockItem
						key={appName}
						label={appName}
						icon={iconOf(appName)}
						isActive={isActive(appName)}
						isHidden={false}
						onClick={() => handleAppOpen(appName)}
						disableRadius={APP_MANIFEST[appName].squareIcon}
					/>
				))}
				{/* macOS처럼 Dock에 보이지 않는 앱(넘쳐 Launchpad로 간 앱, 고정하지 않은 앱)도 실행 중에는 고정 앱 뒤에 나타난다 */}
				{running.map((appName) => (
					<DockItem
						key={appName}
						label={appName}
						icon={iconOf(appName)}
						isActive
						isHidden={false}
						onClick={() => handleAppOpen(appName)}
						disableRadius={APP_MANIFEST[appName].squareIcon}
					/>
				))}
				<DockItem
					label="launchpad"
					icon={`${imgUrl}/launchpad.png`}
					isActive={false}
					isHidden={false}
					onClick={handleLaunchpadClick}
				/>
				<div className="dock-divider" aria-hidden="true" />
				<DockItem
					label="bin"
					icon={iconOf('bin')}
					isActive={false}
					isHidden={false}
					onClick={() => {}} // 휴지통은 아직 동작 없음
				/>
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
