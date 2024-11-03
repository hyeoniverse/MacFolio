import { useState, useEffect, useRef } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../styles/Loading.css';

const LoadingPage = () => {
  const [progress, setProgress] = useState(0);
  const isInteractedRef = useRef(false);
  const mp3Url = process.env.REACT_APP_SFX_URL;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startLoading = () => {
      if (!isInteractedRef.current) {
        isInteractedRef.current = true;
        audioRef.current = new Audio(`${mp3Url}/mac-startup.mp3`);
        
        audioRef.current.play().catch(error => {
          console.error('Audio playback failed:', error);
        });

        timerRef.current = setInterval(() => {
          setProgress((oldProgress) => {
            if (oldProgress >= 100) {
              clearInterval(timerRef.current as NodeJS.Timeout);
              audioRef.current?.pause();
              window.location.href = '/desktop';
              return 100;
            }
            return oldProgress + 2;
          });
        }, 50);
      }
    };

    document.addEventListener('click', startLoading);

    return () => {
      clearInterval(timerRef.current as NodeJS.Timeout);
      audioRef.current?.pause();
      document.removeEventListener('click', startLoading);
    };
  }, [mp3Url]);

  return (
    <div className="loading-container">
      <i className="fa-brands fa-apple loading-icon" />
      {!isInteractedRef.current ? (
        <p className="loading-text">클릭하여 로딩을 시작하세요</p>
      ) : (
        <p className="loading-text" style={{ visibility: 'hidden' }}>클릭하여 로딩을 시작하세요</p>
      )}
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default LoadingPage;