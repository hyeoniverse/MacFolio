import { useCallback, useState } from 'react';
import { useAppState } from '@/desktop/AppStateContext';
import { foregroundApp } from '@/desktop/appStack';
import { useLaunchApp } from '@/desktop/useLaunchApp';
import MobileHome from '@/desktop/mobile/MobileHome';
import MobileStatusBar from '@/desktop/mobile/MobileStatusBar';
import ControlCenter from '@/desktop/mobile/ControlCenter';
import '@/desktop/mobile/MobileShell.css';

/**
 * 모바일 셸: 홈 화면, 그 위의 상태 표시줄, 상태 표시줄을 끌어내리면 나오는 제어 센터.
 * 앱 창(AppWindow 모바일 모드)은 Desktop이 따로 그리고, 상태 표시줄은 앱보다 위에 있다.
 */
const MobileShell = () => {
	const { apps } = useAppState();
	const { launch } = useLaunchApp();
	const [controlCenterOpen, setControlCenterOpen] = useState(false);
	const [pull, setPull] = useState<number | null>(null);

	const closeControlCenter = useCallback(() => setControlCenterOpen(false), []);

	const onApp = foregroundApp(apps) !== null && !controlCenterOpen;

	return (
		<>
			<MobileHome launch={launch} />
			<MobileStatusBar tone={onApp ? 'app' : 'light'} onPull={setPull} onOpen={() => setControlCenterOpen(true)} />
			<ControlCenter open={controlCenterOpen} pull={pull} onClose={closeControlCenter} onLaunch={launch} />
		</>
	);
};

export default MobileShell;
