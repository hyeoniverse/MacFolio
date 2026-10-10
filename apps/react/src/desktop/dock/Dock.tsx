import { cssVars } from '@/shared/lib/cssVars';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useState } from 'react';
import DockItem from '@/desktop/dock/DockItem';
import '@/desktop/dock/Dock.css';
import { useLaunchApp } from '@/desktop/useLaunchApp';

import { env } from '@/shared/config/env';
import { useBinEmpty } from '@/apps/bin/binState';
import { APP_MANIFEST, DOCK_APPS, LAUNCHPAD_APPS, type AppName } from '@/apps/manifest';
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
	// macOS처럼 비었으면 빈 휴지통, 무언가 남아 있으면 종이가 담긴 휴지통
	const binEmpty = useBinEmpty();

	// Dock에 다 들어가지 않는 앱은 Launchpad로 보낸다. 실행 중이라 나타난 앱도 칸에 세어서 Launchpad·휴지통과 겹치지 않는다
	const { width } = useViewport();
	const {
		pinned,
		running,
		launchpad: hiddenItems,
	} = dockLayout(dockAppCapacity(width), DOCK_APPS, LAUNCHPAD_APPS, isActive);
	// 아이콘 크기와 간격은 칸 수를 센 값 그대로 CSS에 넘긴다
	const dockStyle = cssVars({
		'dock-icon': `${dockIconSize(width)}px`,
		'dock-gap': `${DOCK_GAP}px`,
		'dock-padding': `${DOCK_PADDING}px`,
		'dock-divider': `${DOCK_DIVIDER}px`,
	});

	// Launchpad는 닫히면 흐려지며 사라진다
	const launchpad = useExitMotion<HTMLDivElement>('fade-out');

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
					icon={binEmpty ? `${imgUrl}/bin-empty.png` : iconOf('bin')}
					isActive={false}
					isHidden={false}
					onClick={() => handleAppOpen('bin')}
				/>
			</div>

			{/* Launchpad 모달 */}
			{isLaunchpadOpen && hiddenItems.length > 0 && (
				<div ref={launchpad} className="launchpad-modal" onClick={handleOutsideClick}>
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
