import { albumArtworks, albums, trackNames, useMusic } from '@/apps/music/MusicContext';

interface Props {
	/** 위젯의 빈 곳을 눌렀을 때 (음악 앱 열기) */
	onOpen: () => void;
	className?: string;
}

/**
 * 지금 재생 중인 곡과 재생 버튼. 홈 화면 위젯과 제어 센터가 함께 쓴다.
 * 재생 버튼은 음악 앱을 열지 않고 바로 재생한다.
 */
const MusicWidget = ({ onOpen, className = '' }: Props) => {
	const { isPlaying, currentTrack, currentTime, duration, togglePlayPause, playNextTrack, playPreviousTrack } =
		useMusic();
	const progress = duration ? (currentTime / duration) * 100 : 0;

	return (
		<section
			className={`music-widget ${className}`}
			aria-label="음악"
			style={{ ['--artwork' as string]: `url('${albumArtworks[currentTrack]}')` }}
			onClick={(event) => {
				if (!(event.target as Element).closest('button')) onOpen();
			}}
		>
			<img className="music-widget-art" src={albumArtworks[currentTrack]} alt="" draggable={false} />
			<div className="music-widget-body">
				<p className="music-widget-status">
					{isPlaying ? (
						<>
							<span className="music-widget-bars" aria-hidden="true">
								<span></span>
								<span></span>
								<span></span>
							</span>
							지금 재생 중
						</>
					) : (
						'일시 정지됨'
					)}
				</p>
				<strong className="music-widget-title">{trackNames[currentTrack]}</strong>
				<span className="music-widget-album">{albums[currentTrack]}</span>
				<div className="music-widget-progress" aria-hidden="true">
					<div style={{ width: `${progress}%` }}></div>
				</div>
				<div className="music-widget-controls">
					<button type="button" aria-label="이전 곡" onClick={playPreviousTrack}>
						<i className="fas fa-backward" aria-hidden="true"></i>
					</button>
					<button type="button" aria-label={isPlaying ? '일시 정지' : '재생'} onClick={togglePlayPause}>
						<i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
					</button>
					<button type="button" aria-label="다음 곡" onClick={playNextTrack}>
						<i className="fas fa-forward" aria-hidden="true"></i>
					</button>
				</div>
			</div>
		</section>
	);
};

export default MusicWidget;
