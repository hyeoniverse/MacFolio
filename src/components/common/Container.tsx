import React, { useRef, useEffect, useState } from 'react';
import '../../styles/Container.css';
import { AppName, useAppState } from '../../contexts/AppContext';

interface ContainerProps {
	title: string;
	appName: AppName;
	children: React.ReactNode;
	appStyle?: React.CSSProperties;
	contentStyle?: React.CSSProperties;
	titleBarStyle?: React.CSSProperties;
	onClick?: () => void;
}

const Container: React.FC<ContainerProps> = ({
	title,
	appName,
	children,
	appStyle,
	contentStyle,
	titleBarStyle,
	onClick,
}) => {
	const { apps, closeApp, minimizeApp, maximizeApp, bringAppToFront } = useAppState();

	const containerRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState({ x: 100, y: 100 });
	const [previousPosition, setPreviousPosition] = useState<{ x: number; y: number }>({ x: 100, y: 100 }); // 이전 위치 저장
	const [previousSize, setPreviousSize] = useState<{ width: number; height: number }>({ width: 400, height: 300 }); // 이전 크기 저장
	const [isDragging, setIsDragging] = useState(false);
	const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
	const [isResizing, setIsResizing] = useState(false);
	const [resizeDirection, setResizeDirection] = useState('');
	const [isMaximized, setIsMaximized] = useState(false);
	const [isMinimizing, setIsMinimizing] = useState(false); // minimize 애니메이션을 위한 상태 추가
	const [minimizedPosition, setMinimizedPosition] = useState({ x: 0, y: 0 }); // minimizedPosition 상태
	const containerSize = useRef<{ width: number; height: number }>({ width: 400, height: 300 });

	const MIN_WIDTH = 200;
	const MIN_HEIGHT = 150;
	const STATUSBAR_HEIGHT = 25; // 상태 표시줄 높이

	const animationFrameRef = useRef<number | null>(null);

	// 로컬스토리지에 저장된 위치와 크기 불러오기
	const loadPositionAndSizeFromStorage = () => {
		const storedPosition = localStorage.getItem(`containerPosition_${appName}`);
		const storedSize = localStorage.getItem(`containerSize_${appName}`);

		if (storedPosition) {
			const { x, y } = JSON.parse(storedPosition);
			setPosition({ x, y });
		}

		if (storedSize && !isMaximized) {
			const { width, height } = JSON.parse(storedSize);
			containerSize.current = { width, height };
		}
	};

	// 위치와 크기를 로컬 스토리지에 저장
	const savePositionAndSizeToStorage = (x: number, y: number, width: number, height: number) => {
		localStorage.setItem(`containerPosition_${appName}`, JSON.stringify({ x, y }));
		if (!isMaximized) {
			localStorage.setItem(`containerSize_${appName}`, JSON.stringify({ width, height }));
		}
	};

	const handleClose = () => {
		closeApp(appName as keyof typeof useAppState);
		// 닫을 때 위치와 크기 저장
		savePositionAndSizeToStorage(position.x, position.y, containerSize.current.width, containerSize.current.height);
	};

	const handleMinimize = () => {
		const currentPosition = containerRef.current?.getBoundingClientRect();

		if (currentPosition) {
			const { left, top, width, height } = currentPosition;

			// 현재 컨테이너의 중앙 위치를 기준으로 minimizedPosition 설정
			const centerX = left + width / 2;
			const centerY = top + height / 2;
			setMinimizedPosition({ x: centerX, y: centerY });

			setIsMinimizing(true); // 애니메이션을 트리거
			setTimeout(() => {
				minimizeApp(appName as keyof typeof useAppState); // 애니메이션이 끝난 후 최소화 상태로 변경
				setIsMinimizing(false); // 애니메이션 초기화
				savePositionAndSizeToStorage(
					position.x,
					position.y,
					containerSize.current.width,
					containerSize.current.height
				); // 최소화될 때 위치와 크기 저장
			}, 500); // 애니메이션 시간과 맞춰서 0.5초 뒤에 최소화
		}
	};

	const handleMaximize = () => {
		if (isMaximized) {
			// 최대화 취소 (이전 크기 및 위치 복원)
			setPosition(previousPosition); // 저장된 이전 위치로 복원
			containerSize.current = previousSize; // 저장된 이전 크기로 복원
			setIsMaximized(false); // 최대화 상태 해제
		} else {
			// 최대화하기 전에 현재 크기 및 위치 저장
			setPreviousPosition(position); // 현재 위치 저장
			setPreviousSize(containerSize.current); // 현재 크기 저장

			// 화면 전체로 최대화하되 상태바 영역은 제외
			setPosition({ x: 0, y: STATUSBAR_HEIGHT });
			containerSize.current = { width: window.innerWidth, height: window.innerHeight - STATUSBAR_HEIGHT };
			setIsMaximized(true); // 최대화 상태로 설정
		}
	};

	// 크기 조정 시작 처리
	const handleResizeStart = (e: React.MouseEvent, direction: string) => {
		e.preventDefault();
		e.stopPropagation();
		setIsResizing(true);
		setResizeDirection(direction);
	};

	// 마우스 이동에 따른 크기 조정
	const handleResizeMove = (e: MouseEvent) => {
		if (isResizing && containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();

			let newWidth = rect.width;
			let newHeight = rect.height;
			let newX = rect.left;
			let newY = rect.top;

			if (resizeDirection.includes('right')) {
				newWidth = Math.min(window.innerWidth - rect.left, Math.max(MIN_WIDTH, e.clientX - rect.left));
			}

			if (resizeDirection.includes('bottom')) {
				newHeight = Math.min(window.innerHeight - rect.top, Math.max(MIN_HEIGHT, e.clientY - rect.top));
			}

			if (resizeDirection.includes('left')) {
				const deltaX = e.clientX - rect.left;
				newWidth = Math.max(MIN_WIDTH, rect.width - deltaX);
				newX = Math.max(0, rect.left + deltaX);
			}

			if (resizeDirection.includes('top')) {
				const deltaY = e.clientY - rect.top;
				newHeight = Math.max(MIN_HEIGHT, rect.height - deltaY);
				newY = Math.max(STATUSBAR_HEIGHT, rect.top + deltaY);
			}

			// 실제 위치를 가져와 화면 밖으로 벗어나는지 확인 후 제한
			if (newX + newWidth > window.innerWidth) {
				newWidth = window.innerWidth - newX;
			}
			if (newY + newHeight > window.innerHeight) {
				newHeight = window.innerHeight - newY;
			}

			containerSize.current.width = newWidth;
			containerSize.current.height = newHeight;
			setPosition({ x: newX, y: newY });
		}
	};

	const handleResizeEnd = () => {
		setIsResizing(false);
		setResizeDirection('');
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		bringAppToFront(appName as AppName);

		e.preventDefault();
		setIsDragging(true);
		setInitialMousePos({ x: e.clientX - position.x, y: e.clientY - position.y });
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (isDragging && containerRef.current) {
			if (animationFrameRef.current === null) {
				animationFrameRef.current = requestAnimationFrame(() => {
					const { width, height } = containerRef.current!.getBoundingClientRect();
					const newX = e.clientX - initialMousePos.x;
					const newY = e.clientY - initialMousePos.y;

					// 화면을 벗어났는지 확인
					const boundedX = Math.min(Math.max(0, newX), window.innerWidth - width);
					const boundedY = Math.min(Math.max(STATUSBAR_HEIGHT, newY), window.innerHeight - height);

					setPosition({ x: boundedX, y: boundedY });
					animationFrameRef.current = null;
				});
			}
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		if (animationFrameRef.current !== null) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		// 드래그 후 위치 저장
		savePositionAndSizeToStorage(position.x, position.y, containerSize.current.width, containerSize.current.height);
	};

	// 컴포넌트가 로드될 때 위치 및 크기 불러오기
	useEffect(() => {
		loadPositionAndSizeFromStorage();
	}, []);

	useEffect(() => {
		if (isDragging) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
		} else {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		}

		if (isResizing) {
			window.addEventListener('mousemove', handleResizeMove);
			window.addEventListener('mouseup', handleResizeEnd);
		} else {
			window.removeEventListener('mousemove', handleResizeMove);
			window.removeEventListener('mouseup', handleResizeEnd);
		}

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('mousemove', handleResizeMove);
			window.removeEventListener('mouseup', handleResizeEnd);
		};
	}, [isDragging, isResizing]);

	useEffect(() => {
		const handleResize = () => {
			if (containerRef.current) {
				const { width, height } = containerRef.current.getBoundingClientRect();

				// 현재 위치가 화면을 벗어나지 않도록 제한
				const boundedX = Math.min(Math.max(0, position.x), window.innerWidth - width);
				const boundedY = Math.min(Math.max(25, position.y), window.innerHeight - height);

				setPosition({ x: boundedX, y: boundedY });
			}
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, [position]);

	return (
		<div
			className={`container ${isMinimizing ? 'minimizing' : ''}`} // 애니메이션을 위한 클래스 추가
			style={{
				...appStyle,
				width: `${containerSize.current.width}px`,
				height: `${containerSize.current.height}px`,
				left: position.x,
				top: position.y,
				position: 'absolute',
				zIndex: apps[appName as AppName].zIndex,
				transform: isMinimizing
					? `translate(${minimizedPosition.x - position.x}px, ${minimizedPosition.y - position.y}px) scale(0)`
					: 'none',
				opacity: isMinimizing ? 0 : 1,
				transition: 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out', // 애니메이션 설정
			}}
			ref={containerRef}
			onClick={onClick}
		>
			<div
				className="macos-titlebar"
				onMouseDown={handleMouseDown}
				style={{
					...titleBarStyle,
					cursor: 'grab',
				}}
				onDoubleClick={handleMaximize}
			>
				<div className="traffic-lights">
					<span className="close" onClick={handleClose}></span>
					<span className="minimize" onClick={handleMinimize}></span>
					<span className="fullscreen" onClick={handleMaximize}></span>
				</div>
				<span className="title">{title}</span>
			</div>
			<div
				className="content"
				ref={containerRef}
				style={{ ...contentStyle }}
				onClick={() => bringAppToFront(appName as AppName)}
			>
				{children}
			</div>

			{/* 각 모서리와 변에 크기 조절 핸들 추가 */}
			<div className="resize-handle top" onMouseDown={(e) => handleResizeStart(e, 'top')}></div>
			<div className="resize-handle right" onMouseDown={(e) => handleResizeStart(e, 'right')}></div>
			<div className="resize-handle bottom" onMouseDown={(e) => handleResizeStart(e, 'bottom')}></div>
			<div className="resize-handle left" onMouseDown={(e) => handleResizeStart(e, 'left')}></div>
			<div className="resize-handle top-left" onMouseDown={(e) => handleResizeStart(e, 'top-left')}></div>
			<div className="resize-handle top-right" onMouseDown={(e) => handleResizeStart(e, 'top-right')}></div>
			<div className="resize-handle bottom-left" onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}></div>
			<div className="resize-handle bottom-right" onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}></div>
		</div>
	);
};

export default Container;
