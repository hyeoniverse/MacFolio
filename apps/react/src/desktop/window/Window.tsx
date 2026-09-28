import React, { useEffect, useRef, useState } from 'react';
import '@/desktop/window/Window.css';
import { useAppState } from '@/desktop/AppStateContext';
import type { AppName } from '@/apps/manifest';
import { useWindowFrame } from '@/desktop/window/useWindowFrame';
import type { ResizeDirection } from '@/desktop/window/geometry';

interface AppWindowProps {
	title: string;
	appName: AppName;
	children: React.ReactNode;
	appStyle?: React.CSSProperties;
	contentStyle?: React.CSSProperties;
	titleBarStyle?: React.CSSProperties;
	onClick?: () => void;
	/**
	 * titlebar: 제목 표시줄이 있는 창 (기본)
	 * unified: macOS 26처럼 제목 표시줄 없이 신호등 버튼이 내용 위에 떠 있는 창.
	 *   창 위쪽 52px를 잡아 옮길 수 있고, 그 영역의 버튼은 z-index를 올려야 누를 수 있다.
	 */
	chrome?: 'titlebar' | 'unified';
}

const RESIZE_DIRECTIONS: ResizeDirection[] = [
	'top',
	'right',
	'bottom',
	'left',
	'top-left',
	'top-right',
	'bottom-left',
	'bottom-right',
];

/** 최소화 애니메이션 시간 (Window.css와 같아야 한다) */
const MINIMIZE_MS = 500;

/**
 * 앱 창. 앱이 실행 중이 아니거나 최소화되어 있으면 아무것도 그리지 않는다.
 * 앱 컴포넌트는 표시 여부를 따로 확인하지 않아도 된다.
 */
const AppWindow: React.FC<AppWindowProps> = ({
	title,
	appName,
	children,
	appStyle,
	contentStyle,
	titleBarStyle,
	onClick,
	chrome = 'titlebar',
}) => {
	const { apps, closeApp, minimizeApp, bringAppToFront } = useAppState();
	const { rect, toggleMaximize, dragHandlers, resizeHandlers } = useWindowFrame(appName);
	const [isMinimizing, setIsMinimizing] = useState(false);
	const minimizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => clearTimeout(minimizeTimer.current ?? undefined), []);

	const { isRunning, isMinimized, zIndex } = apps[appName];
	if (!isRunning || isMinimized) return null;

	const handleMinimize = () => {
		setIsMinimizing(true);
		minimizeTimer.current = setTimeout(() => {
			minimizeApp(appName);
			setIsMinimizing(false);
		}, MINIMIZE_MS);
	};

	return (
		<div
			data-app={appName}
			aria-label={chrome === 'unified' ? title : undefined}
			className={`container ${chrome === 'unified' ? 'unified' : ''} ${isMinimizing ? 'minimizing' : ''}`}
			style={{
				...appStyle,
				left: rect.x,
				top: rect.y,
				width: rect.width,
				height: rect.height,
				position: 'absolute',
				zIndex,
				// 창 가운데로 작아지며 사라진다
				transform: isMinimizing ? `translate(${rect.width / 2}px, ${rect.height / 2}px) scale(0)` : 'none',
				opacity: isMinimizing ? 0 : 1,
				transition: `transform ${MINIMIZE_MS}ms ease-in-out, opacity ${MINIMIZE_MS}ms ease-in-out`,
			}}
			// 캡처 단계에서 처리해야 제목 표시줄·핸들이 이벤트 전파를 막아도 맨 앞으로 온다
			onPointerDownCapture={() => bringAppToFront(appName)}
			onClick={onClick}
		>
			<div
				className="macos-titlebar"
				style={{ ...titleBarStyle, cursor: 'grab', touchAction: 'none' }}
				onDoubleClick={toggleMaximize}
				{...dragHandlers}
			>
				<div className="traffic-lights">
					<span className="close" role="button" aria-label="닫기" onClick={() => closeApp(appName)}></span>
					<span className="minimize" role="button" aria-label="최소화" onClick={handleMinimize}></span>
					<span className="fullscreen" role="button" aria-label="전체 화면" onClick={toggleMaximize}></span>
				</div>
				{chrome === 'titlebar' && <span className="title">{title}</span>}
			</div>
			<div className="content" style={{ ...contentStyle }}>
				{children}
			</div>

			{RESIZE_DIRECTIONS.map((direction) => (
				<div
					key={direction}
					className={`resize-handle ${direction}`}
					style={{ touchAction: 'none' }}
					{...resizeHandlers(direction)}
				></div>
			))}
		</div>
	);
};

export default AppWindow;
