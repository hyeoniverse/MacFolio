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
  const [containerSize, setContainerSize] = useState({ width: 400, height: 300 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false); // minimize 애니메이션을 위한 상태 추가
  const [minimizedPosition, setMinimizedPosition] = useState({ x: 0, y: 0 }); // minimizedPosition 상태

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
      setContainerSize({ width, height });
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
    savePositionAndSizeToStorage(position.x, position.y, containerSize.width, containerSize.height);
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
        savePositionAndSizeToStorage(position.x, position.y, containerSize.width, containerSize.height); // 최소화될 때 위치와 크기 저장
      }, 500); // 애니메이션 시간과 맞춰서 0.5초 뒤에 최소화
    }
  };

  const handleMaximize = () => {
    if (isMaximized) {
      // 최대화 취소 (이전 크기 및 위치 복원)
      setPosition(previousPosition); // 저장된 이전 위치로 복원
      setContainerSize(previousSize); // 저장된 이전 크기로 복원
      setIsMaximized(false); // 최대화 상태 해제
    } else {
      // 최대화하기 전에 현재 크기 및 위치 저장
      setPreviousPosition(position); // 현재 위치 저장
      setPreviousSize(containerSize); // 현재 크기 저장

      // 화면 전체로 최대화하되 상태바 영역은 제외
      setPosition({ x: 0, y: STATUSBAR_HEIGHT });
      setContainerSize({ width: window.innerWidth, height: window.innerHeight - STATUSBAR_HEIGHT });
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
      const { width, height, left, top } = containerRef.current.getBoundingClientRect();

      if (resizeDirection.includes('right')) {
        const newWidth = Math.max(MIN_WIDTH, e.clientX - left);
        setContainerSize((prev) => ({ ...prev, width: newWidth }));
      }

      if (resizeDirection.includes('bottom')) {
        const newHeight = Math.max(MIN_HEIGHT, e.clientY - top);
        setContainerSize((prev) => ({ ...prev, height: newHeight }));
      }

      if (resizeDirection.includes('left')) {
        const newWidth = Math.max(MIN_WIDTH, width - (e.clientX - left));
        setContainerSize((prev) => ({ ...prev, width: newWidth }));
        setPosition((prev) => ({ ...prev, x: prev.x + (width - newWidth) }));
      }

      if (resizeDirection.includes('top')) {
        const newHeight = Math.max(MIN_HEIGHT, height - (e.clientY - top));
        const deltaY = height - newHeight;
        setContainerSize((prev) => ({ ...prev, height: newHeight }));
        setPosition((prev) => ({ ...prev, y: prev.y + deltaY }));
      }
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
    if (isDragging) {
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(() => {
          const newX = e.clientX - initialMousePos.x;
          const newY = e.clientY - initialMousePos.y;
          const boundedY = Math.max(25, newY);

          setPosition({ x: newX, y: boundedY });
          animationFrameRef.current = null; // 다음 프레임을 위해 초기화
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
    savePositionAndSizeToStorage(position.x, position.y, containerSize.width, containerSize.height);
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

  return (
    <div
      className={`container ${isMinimizing ? 'minimizing' : ''}`} // 애니메이션을 위한 클래스 추가
      style={{
        ...appStyle,
        width: `${containerSize.width}px`,
        height: `${containerSize.height}px`,
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
