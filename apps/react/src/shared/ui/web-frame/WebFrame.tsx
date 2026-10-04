import { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/desktop/AppStateContext';
import type { AppName } from '@/apps/manifest';
import '@/shared/ui/web-frame/WebFrame.css';

/** 이만큼 지나도 다 불러지지 않으면 새 탭에서 여는 길을 알려 준다 */
const SLOW_MS = 8000;

interface WebFrameProps {
	/** 띄울 주소 */
	src: string;
	/** iframe 이름 (스크린 리더) */
	title: string;
	/** 이 틀이 들어 있는 앱 (iframe 안을 누르면 그 창을 맨 앞으로) */
	appName: AppName;
	/** 불러오는 동안 가운데에 보일 아이콘 */
	icon?: string;
	/** 불러오는 동안의 바탕 (사이트 바탕색에 맞춘다) */
	tone?: 'light' | 'dark';
	allow?: string;
}

/**
 * 다른 사이트를 창 안에 그대로 띄우는 틀 (프로젝트 앱, API 문서 앱).
 * 불러오는 동안 아이콘을 보여 주고, 오래 걸리면 새 탭에서 여는 링크를 띄운다
 * (사이트가 다른 곳에 들어가는 것을 막아 두었으면 iframe에는 빈 화면만 남기 때문이다).
 */
const WebFrame = ({ src, title, appName, icon, tone = 'light', allow }: WebFrameProps) => {
	const frame = useRef<HTMLIFrameElement>(null);
	const { bringAppToFront } = useAppState();
	const [loaded, setLoaded] = useState(false);
	const [slow, setSlow] = useState(false);

	// iframe 안을 누르면 이벤트가 창까지 오지 않는다. 대신 이 문서가 포커스를 잃으니, 그때 창을 맨 앞으로
	useEffect(() => {
		const onBlur = () => {
			if (document.activeElement === frame.current) bringAppToFront(appName);
		};
		window.addEventListener('blur', onBlur);
		return () => window.removeEventListener('blur', onBlur);
	}, [appName, bringAppToFront]);

	useEffect(() => {
		if (loaded) return;
		const timer = setTimeout(() => setSlow(true), SLOW_MS);
		return () => clearTimeout(timer);
	}, [loaded]);

	return (
		<div className={`web-frame ${tone}`}>
			<iframe ref={frame} src={src} title={title} allow={allow} allowFullScreen onLoad={() => setLoaded(true)} />
			{!loaded && (
				<div className="web-frame-loading" role="status">
					{icon && <img src={icon} alt="" />}
					<span>{title} 불러오는 중…</span>
					{slow && (
						<a href={src} target="_blank" rel="noopener noreferrer">
							열리지 않으면 새 탭에서 열기
						</a>
					)}
				</div>
			)}
		</div>
	);
};

export default WebFrame;
