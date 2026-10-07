import { useAppMenus } from '@/desktop/status-bar/appMenus';
import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/desktop/AppStateContext';
import type { AppName } from '@/apps/manifest';
import '@/shared/ui/web-frame/WebFrame.css';
import { openExternal } from '@/shared/analytics/analytics';

/** 이만큼 지나도 페이지가 다 불러지지 않으면 새 탭에서 여는 길을 알려 준다 */
const SLOW_MS = 8000;

interface WebFrameProps {
	src: string;
	title: string;
	/** 이 틀을 담은 창의 앱 (iframe 안을 누르면 이 창을 맨 앞으로) */
	appName: AppName;
	/** 불러오는 동안 가운데 보일 아이콘 */
	icon?: string;
	/** 불러오는 동안의 바탕 (페이지의 바탕색에 맞춘다) */
	tone?: 'light' | 'dark';
	allow?: string;
}

/**
 * 다른 페이지를 창 안에 그대로 띄우는 틀 (iframe): 프로젝트 앱(배포한 사이트), API 문서 앱(api-docs.html).
 * 불러오는 동안은 아이콘을 보여 주고, 오래 걸리면 새 탭에서 여는 링크를 띄운다
 * (사이트가 다른 곳에 들어가는 것을 막아 두었으면 iframe에는 빈 화면만 남기 때문이다).
 */
const WebFrame: React.FC<WebFrameProps> = ({ src, title, appName, icon, tone = 'light', allow }) => {
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

	// 메뉴 막대 메뉴 (#96): 프로젝트 앱·API 문서가 함께 쓴다
	const reload = () => {
		setLoaded(false);
		setSlow(false);
		// 다른 주소의 페이지는 안에서 새로 고칠 수 없어서 주소를 다시 넣는다
		if (frame.current) frame.current.src = src;
	};
	useAppMenus(appName, [
		{
			title: '파일',
			items: [
				{
					label: '새 탭에서 열기',
					icon: 'fa-solid fa-arrow-up-right-from-square',
					onSelect: () => openExternal(src),
				},
			],
		},
		{ title: '보기', items: [{ label: '새로 고침', shortcut: { code: 'KeyR', alt: true }, onSelect: reload }] },
	]);

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
