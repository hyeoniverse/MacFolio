import React, { useLayoutEffect, useRef } from 'react';
import '@/desktop/window/Window.css';
import { useAppState } from '@/desktop/AppStateContext';
import type { AppName } from '@/apps/manifest';
import { useWindowFrame } from '@/desktop/window/useWindowFrame';
import type { ResizeDirection } from '@/desktop/window/geometry';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import HomeIndicator from '@/desktop/mobile/HomeIndicator';
import { animateClose, animateOpen } from '@/desktop/window/windowMotion';

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

/** 전체 화면 전환 애니메이션 시간 (Window.css의 .frame-animating과 같아야 한다) */
const FRAME_MS = 300;

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
	const { apps, closeApp, minimizeApp, bringAppToFront, goHome } = useAppState();
	const isMobile = useIsMobile();
	const { rect, toggleMaximize, dragHandlers, resizeHandlers } = useWindowFrame(appName);
	const frameRef = useRef<HTMLDivElement>(null);

	const { isRunning, isMinimized, zIndex } = apps[appName];
	const visible = isRunning && !isMinimized;

	// 보이게 될 때마다(열기, 최소화에서 되돌리기) 아이콘에서 커지며 나타난다
	useLayoutEffect(() => {
		if (visible && frameRef.current) animateOpen(frameRef.current, { appName, mobile: isMobile });
	}, [visible, appName, isMobile]);

	if (!visible) return null;

	/** 애니메이션이 끝난 뒤 action을 실행한다 */
	const leave = (toLauncher: boolean, action: () => void) => {
		const element = frameRef.current;
		if (!element || element.classList.contains('closing')) return;
		animateClose(element, { appName, mobile: isMobile, toLauncher }, action);
	};
	const handleHome = () => leave(true, goHome);
	const handleClose = () => leave(false, () => closeApp(appName));
	const handleMinimize = () => leave(true, () => minimizeApp(appName));

	// 전체 화면 전환은 위치·크기가 부드럽게 바뀐다 (끌기·크기 조절 중에는 바로 따라가야 해서 이때만 켠다)
	const handleToggleMaximize = () => {
		const element = frameRef.current;
		element?.classList.add('frame-animating');
		setTimeout(() => element?.classList.remove('frame-animating'), FRAME_MS);
		toggleMaximize();
	};

	// 모바일: 화면을 가득 채우고, 신호등 버튼 대신 홈 인디케이터로 홈 화면에 돌아간다
	if (isMobile) {
		return (
			<div
				ref={frameRef}
				data-app={appName}
				aria-label={title}
				className={`container mobile ${chrome === 'unified' ? 'unified' : ''}`}
				style={{ ...appStyle, zIndex }}
				onClick={onClick}
			>
				{chrome === 'titlebar' ? (
					<div className="mobile-navbar" style={titleBarStyle}>
						<button type="button" className="mobile-navbar-home" onClick={handleHome}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true"></i>홈
						</button>
						<span className="title">{title}</span>
					</div>
				) : (
					// 통합형 창은 신호등 버튼이 있던 자리에 홈 버튼을 띄운다
					<button type="button" className="mobile-navbar-home floating" onClick={handleHome}>
						<i className="fa-solid fa-chevron-left" aria-hidden="true"></i>홈
					</button>
				)}
				<div className="content" style={{ ...contentStyle }}>
					{children}
				</div>
				<HomeIndicator onHome={handleHome} />
			</div>
		);
	}

	return (
		<div
			ref={frameRef}
			data-app={appName}
			aria-label={chrome === 'unified' ? title : undefined}
			className={`container ${chrome === 'unified' ? 'unified' : ''}`}
			style={{
				...appStyle,
				left: rect.x,
				top: rect.y,
				width: rect.width,
				height: rect.height,
				position: 'absolute',
				zIndex,
			}}
			// 캡처 단계에서 처리해야 제목 표시줄·핸들이 이벤트 전파를 막아도 맨 앞으로 온다
			onPointerDownCapture={() => bringAppToFront(appName)}
			onClick={onClick}
		>
			<div
				className="macos-titlebar"
				style={{ ...titleBarStyle, cursor: 'grab', touchAction: 'none' }}
				onDoubleClick={handleToggleMaximize}
				{...dragHandlers}
			>
				<div className="traffic-lights">
					<span className="close" role="button" aria-label="닫기" onClick={handleClose}></span>
					<span className="minimize" role="button" aria-label="최소화" onClick={handleMinimize}></span>
					<span className="fullscreen" role="button" aria-label="전체 화면" onClick={handleToggleMaximize}></span>
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
