import React, { useEffect, useRef } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { PROJECTS } from '@/shared/profile';
import '@/apps/sproutfarm/SproutFarm.css';

const GAME_URL = PROJECTS.find((project) => project.id === 'sproutfarm')?.demo ?? 'https://sprout-farm-beta.vercel.app';

/**
 * 새싹 농장: 배포한 WebGL 게임을 창 안에 그대로 띄운다 (iframe).
 * 게임은 START를 눌러야 불러오므로, 창을 열기만 해서는 무겁지 않다. PC 전용이라 모바일에는 없다.
 */
const SproutFarm: React.FC = () => {
	const frame = useRef<HTMLIFrameElement>(null);
	const { bringAppToFront } = useAppState();

	// iframe 안을 누르면 이벤트가 창까지 오지 않는다. 대신 이 문서가 포커스를 잃으니, 그때 창을 맨 앞으로
	useEffect(() => {
		const onBlur = () => {
			if (document.activeElement === frame.current) bringAppToFront('sproutfarm');
		};
		window.addEventListener('blur', onBlur);
		return () => window.removeEventListener('blur', onBlur);
	}, [bringAppToFront]);

	return (
		<AppWindow title="SproutFarm 새싹 농장" appName="sproutfarm">
			<div className="sproutfarm">
				<iframe
					ref={frame}
					src={GAME_URL}
					title="SproutFarm 새싹 농장"
					allow="autoplay; fullscreen; gamepad"
					allowFullScreen
				/>
			</div>
		</AppWindow>
	);
};

export default SproutFarm;
