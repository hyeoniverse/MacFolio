// Path: client/src/components/common/VolumeModal.tsx

import React from 'react';
import { useMusic } from '../../contexts/MusicContext'; // MusicContext 사용

interface VolumeModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const VolumeModal: React.FC<VolumeModalProps> = ({ isVisible, onClose }) => {
  const { volume, setVolume } = useMusic();

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const getVolumeIcon = () => {
    if (volume === 0) {
      return <i className="fas fa-volume-off volume-icon"></i>;
    } else if (volume <= 0.5) {
      return <i className="fas fa-volume-low volume-icon"></i>;
    } else {
      return <i className="fas fa-volume-high volume-icon"></i>;
    }
  };

  if (!isVisible) return null;

  return (
    <div className="volume-modal-overlay" onClick={onClose}>
    <div className="volume-container">
    <div
          className="volume-level" // 볼륨 수준을 표시하는 컨테이너
          style={{
            height: `${volume * 100}%`, // 볼륨 값을 기반으로 컨테이너 높이를 설정
          }}
    ></div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={handleVolumeChange}
        className="volume-slider"
        aria-label="Volume Slider"
        onClick={(e) => e.stopPropagation()}
      />
      {getVolumeIcon()}
    </div>
    </div>
  );
};

export default VolumeModal;
