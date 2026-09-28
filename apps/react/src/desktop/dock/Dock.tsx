import React, { useState } from 'react';
import DockItem from '@/desktop/dock/DockItem';
import '@/desktop/dock/Dock.css';
import { useAppState } from '@/desktop/AppStateContext';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@/desktop/dock/Toast.css';
import { env } from '@/shared/config/env';
import { APP_MANIFEST, DOCK_APPS, type AppName } from '@/apps/manifest';
import { useViewport } from '@/shared/hooks/useViewport';

const imgUrl = env.imageUrl;
const iconOf = (appName: AppName) => `${imgUrl}/${APP_MANIFEST[appName].icon}`;

const Dock: React.FC = () => {
	const { apps, openApp, maximizeApp, bringAppToFront } = useAppState();
	const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false); // 모달 상태 관리
	const [isSharing, setIsSharing] = useState(false); // share 앱의 인디케이터 상태 관리

	// Dock에 다 들어가지 않는 앱은 Launchpad로 보낸다 (아이콘 하나당 100px, 양옆 여백 300px)
	const { width } = useViewport();
	const maxItems = Math.floor((width - 300) / 100);
	const hiddenItems: AppName[] = DOCK_APPS.length > maxItems ? DOCK_APPS.slice(maxItems) : [];

	const isShareApp = (appName: AppName) => APP_MANIFEST[appName].action?.type === 'share';

	const handleAppOpen = (appName: AppName) => {
		const appState = apps[appName];
		const action = APP_MANIFEST[appName].action;

		bringAppToFront(appName);

		if (action?.type === 'link') {
			// 외부 페이지로 새 탭에서 이동
			window.open(action.url, '_blank');
			return;
		}

		if (action?.type === 'share') {
			// share 앱 클릭 시 Toast 메시지 표시
			navigator.clipboard.writeText(window.location.href);
			setIsSharing(true); // Toast 표시 시 인디케이터 활성화

			toast.info('링크가 복사되었습니다!', {
				className: 'custom-toast', // 커스텀 클래스 적용
				progressClassName: 'custom-toast-progress', // 커스텀 클래스 적용
				onClose: () => setIsSharing(false), // Toast가 닫힐 때 인디케이터 비활성화
			});
		} else if (appState.isRunning) {
			maximizeApp(appName);
		} else {
			openApp(appName);
		}
	};

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

	// Launchpad 내에서의 share 앱 상태를 따로 관리 (Launchpad 안에서는 인디케이터 표시 안 함)
	const getLaunchpadAppState = (appName: AppName) => {
		if (isShareApp(appName)) {
			return isSharing; // share 앱의 경우 인디케이터는 isSharing 상태에 따름
		}
		return apps[appName].isRunning; // Launchpad 내에서도 앱이 실행 중이면 인디케이터 유지
	};

	return (
		<div>
			<ToastContainer
				position="top-right"
				autoClose={1200}
				hideProgressBar={true}
				newestOnTop={false}
				closeOnClick
				pauseOnFocusLoss
				draggable
				pauseOnHover
			/>
			<div className="dock">
				<div className="dock-left">
					{DOCK_APPS.map(
						(appName) =>
							!hiddenItems.includes(appName) && (
								<DockItem
									key={appName}
									label={appName}
									icon={iconOf(appName)}
									// share 앱에만 isSharing 적용
									isActive={isShareApp(appName) ? isSharing : apps[appName].isRunning}
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
									isActive={getLaunchpadAppState(hiddenItem)} // Launchpad 내 숨겨진 앱의 인디케이터만 표시
									isHidden={false}
									onClick={() => handleAppOpen(hiddenItem)}
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
