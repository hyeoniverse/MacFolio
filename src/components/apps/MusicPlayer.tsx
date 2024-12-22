import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAppState } from '../../contexts/AppContext';
import { useMusic, albums, trackNames, albumArtworks } from '../../contexts/MusicContext';

import "../../styles/MusicPlayer.css";
import '../../styles/Container.css';

const MusicPlayer: React.FC = () => {
  const { apps, closeApp, minimizeApp, bringAppToFront } = useAppState();
  const { isPlaying, currentTrack, currentTime, duration, isBuffering,
    stopAndReset, togglePlayPause, playNextTrack, playPreviousTrack,
    seekTo, updatePlayerVisualState } = useMusic();  // startPlaying 대신 togglePlayPause 사용
  const { isRunning, isMinimized, zIndex } = apps.music;

  const [isDragging, setIsDragging] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);  // minimize 애니메이션을 위한 상태 추가
  const [position, setPosition] = useState({ x: window.innerWidth - 450, y: 80 });
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
  const [minimizedPosition, setMinimizedPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const playerRef = useRef<HTMLDivElement | null>(null);
  const playerTrackRef = useRef<HTMLDivElement | null>(null);
  const albumArtRef = useRef<HTMLImageElement | null>(null);
  const titleBarRef = useRef<HTMLDivElement | null>(null);

  const [interactionDone, setInteractionDone] = useState(false);

  // 마우스를 눌렀을 때 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    bringAppToFront("music");
    e.preventDefault();
    setIsDragging(true);
    setInitialMousePos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // 드래그 중일 때 플레이어 창 위치 업데이트
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.min(Math.max(0, e.clientX - initialMousePos.x), window.innerWidth - playerRef.current!.offsetWidth);
      const newY = Math.min(Math.max(25, e.clientY - initialMousePos.y), window.innerHeight - playerRef.current!.offsetHeight);
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, initialMousePos]);

  // 마우스를 떼면 드래그 중지
  const handleMouseUp = () => setIsDragging(false);

  // 드래그를 위한 이벤트 리스너 추가/제거
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  const handleCloseApp = () => {
    stopAndReset();  // 음악을 중지하고 상태 초기화
    closeApp("music");
  };

  // 최소화 애니메이션 처리
  const handleMinimize = () => {
    const currentPosition = playerRef.current?.getBoundingClientRect();

    if (currentPosition) {
      const { left, top, width, height } = currentPosition;

      // 현재 컨테이너의 중앙 위치를 기준으로 minimizedPosition 설정
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      setMinimizedPosition({ x: centerX, y: centerY });

      setIsMinimizing(true); // 애니메이션 트리거
      setTimeout(() => {
        minimizeApp("music"); // 최소화 상태로 변경
        setIsMinimizing(false); // 애니메이션 초기화
      }, 500); // 애니메이션 시간과 맞춰서 0.5초 뒤에 최소화
    }
  };

  // 사용자 상호작용을 트리거로 음악을 재생
  const handleFirstInteraction = () => {
    if (!interactionDone) {
      togglePlayPause();  // 첫 상호작용 시 음악 재생
      setInteractionDone(true);  // 첫 상호작용 이후 더 이상 트리거되지 않게 설정
    }
  };

  // 페이지가 로드될 때 첫 사용자 상호작용 감지
  useEffect(() => {
    if (!interactionDone) {
      window.addEventListener('click', handleFirstInteraction);  // 클릭 이벤트 감지
    }

    return () => {
      window.removeEventListener('click', handleFirstInteraction);  // 이벤트 클리너
    };
  }, [interactionDone]);

  // isPlaying 상태에 따라 시각적 상태 업데이트
  useEffect(() => {
    if (playerTrackRef.current && albumArtRef.current && titleBarRef.current) {
      updatePlayerVisualState(isPlaying, playerTrackRef.current, albumArtRef.current, titleBarRef.current);
    }
  }, [isPlaying, updatePlayerVisualState]);

  if (!isRunning) return null;

  return (
    <div
      className={`music-player ${isMinimizing ? 'minimizing' : ''}`}  // 애니메이션 클래스 추가
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        position: "absolute",
        display: isMinimized ? "none" : "block",  // 최소화 시 플레이어 UI를 숨김
        zIndex: zIndex,  // z-index 적용
        transform: isMinimizing ? `translate(${minimizedPosition.x - position.x}px, ${minimizedPosition.y - position.y}px) scale(0)` : 'none',
        opacity: isMinimizing ? 0 : 1,
        transition: 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out',  // 애니메이션 설정
      }}
      ref={playerRef}
      onClick={() => bringAppToFront("music")}
    >
      {/* 음악 플레이어의 타이틀바 */}
      <div
        className="macos-titlebar"
        ref={titleBarRef}
        style={{
          position: "absolute", right: "10px", top: "-10px", width: "90%", height: "6em", padding:"0 0 3.5rem 0.5rem",
          borderRadius: "1rem 1rem 0 0"
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 닫기 및 최소화 버튼 */}
        <div className="traffic-lights">
          <span className="close" onClick={handleCloseApp}></span>
          <span className="minimize" onClick={handleMinimize}></span>
        </div>
        <span className="title">MusicPlayer</span>
      </div>

      {/* 메인 플레이어 UI */}
      <div id="app-cover">
        <div id="player">
          <div id="player-track" ref={playerTrackRef}>
            <div id="album-name">{albums[currentTrack]}</div>
            <div id="track-name">{trackNames[currentTrack]}</div>
            <div id="track-time">
              {/* 현재 재생 시간 및 트랙 길이 표시 */}
              <div id="current-time">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, "0")}
              </div>
              <div id="track-length">
                {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}
              </div>
            </div>
            {/* 시크바 클릭 시 트랙 탐색 */}
            <div id="s-area" onClick={(e) => seekTo(e.nativeEvent.offsetX / e.currentTarget.offsetWidth * duration)}>
              <div id="seek-bar" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
            </div>
          </div>

          {/* 플레이어 컨텐츠 (앨범 아트 및 제어 버튼들) */}
          <div id="player-content">
            <div id="album-art" className={isPlaying ? "active" : ""}>
              <img
                src={albumArtworks[currentTrack]}
                ref={albumArtRef}
                alt={`album-art-${currentTrack}`}
              />
              {/* 오디오 로딩 중일 때 버퍼링 표시 */}
              {isBuffering && <div id="buffer-box">Buffering ...</div>}
            </div>

            {/* 오디오 제어 버튼들 (이전, 재생/일시정지, 다음) */}
            <div id="player-controls">
              <div className="control" onClick={playPreviousTrack}>
                <div className="button" id="play-previous">
                  <i className="fas fa-backward"></i>
                </div>
              </div>
              <div className="control" onClick={togglePlayPause}>
                <div className="button" id="play-pause-button">
                  <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"}`}></i>
                </div>
              </div>
              <div className="control" onClick={playNextTrack}>
                <div className="button" id="play-next">
                  <i className="fas fa-forward"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
