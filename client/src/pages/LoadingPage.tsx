import { useState, useEffect, useRef } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';

const LoadingPage = () => {
  const [progress, setProgress] = useState(0);
  const isInteractedRef = useRef(false); // useRef로 isInteracted 상태 관리
  const mp3Url = process.env.REACT_APP_SFX_URL;

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    let audio: HTMLAudioElement;

    // 사용자 상호작용 후 오디오를 재생합니다.
    const startLoading = () => {
      if (!isInteractedRef.current) {
        isInteractedRef.current = true; // isInteracted 상태를 useRef로 설정
        audio = new Audio(`${mp3Url}/mac-startup.mp3`); // 오디오 파일 경로 설정

        audio.play().catch((error) => {
          console.error('Audio playback failed:', error);
        });

        timer = setInterval(() => {
          setProgress((oldProgress) => {
            if (oldProgress === 100) {
              clearInterval(timer);
              audio.pause(); // 로딩이 끝나면 소리를 멈춥니다.
              window.location.href = '/desktop';
              return 100;
            }
            return oldProgress + 2;
          });
        }, 50);
      }
    };

    // 페이지 클릭 시 로딩을 시작합니다.
    document.addEventListener('click', startLoading);

    // 컴포넌트가 언마운트될 때 오디오와 타이머를 정리합니다.
    return () => {
      clearInterval(timer);
      if (audio) audio.pause();
      document.removeEventListener('click', startLoading);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
      }}
    >
      <i
        className="fa-brands fa-apple"
        style={{
          fontSize: '10rem',
          color: '#fff',
          filter: 'drop-shadow(0 0 0.3rem #fff)',
          marginBottom: '2rem',
        }}
      />
      <div
        style={{
          width: '10rem',
          height: '0.5rem',
          backgroundColor: '#333',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          boxShadow: '0 0 0.5rem #fff',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#fff',
            transition: 'width 0.1s ease-out',
          }}
        />
      </div>
      {!isInteractedRef.current && (
        <p style={{ color: '#fff', marginTop: '2rem' }}>클릭하여 로딩을 시작하세요</p>
      )}
    </div>
  );
};

export default LoadingPage;
