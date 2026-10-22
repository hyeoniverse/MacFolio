import { useEffect, useMemo, useState } from 'react';
import { photosOf } from './photoSources';
import { usePhotoSources } from './usePhotoSources';

/** 사진을 넘기는 간격 (영상은 끝까지 재생한 뒤 넘긴다) */
const INTERVAL_MS = 10_000;

/**
 * 고른 앨범이나 Finder › 그림의 폴더를 차례로 (고르지 않았거나 없어진 곳이면 모든 앨범).
 * 영상은 소리 없이 저절로 재생하고, 끝나면 다음으로 넘긴다. 오른쪽 위 단추로 소리를 켠다
 */
const PhotoWidget = ({ album }: { album?: string }) => {
	const sources = usePhotoSources();
	const photos = useMemo(() => photosOf(sources, album), [sources, album]);
	const [index, setIndex] = useState(0);
	const [muted, setMuted] = useState(true);
	const photo = photos.length ? photos[index % photos.length] : undefined;
	const next = () => setIndex((value) => value + 1);
	// 사진은 시간마다 넘기고, 영상은 onEnded가 넘긴다
	const video = photo?.video === true;
	useEffect(() => {
		if (video) return;
		const timer = window.setTimeout(() => setIndex((value) => value + 1), INTERVAL_MS);
		return () => window.clearTimeout(timer);
	}, [video, index]);
	if (!photo) return <p className="widget-note">사진이 없습니다</p>;
	return (
		<figure className="widget-photo-body">
			{video ? (
				<>
					<video
						key={photo.src}
						src={photo.src}
						aria-label={photo.caption}
						autoPlay
						muted={muted}
						playsInline
						// 영상 하나뿐이면 끝없이 되풀이하고, 여럿이면 끝나면 다음으로
						loop={photos.length === 1}
						onEnded={next}
						draggable={false}
					/>
					<button
						type="button"
						className="widget-photo-sound"
						aria-label={muted ? '소리 켜기' : '소리 끄기'}
						aria-pressed={!muted}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={() => setMuted((value) => !value)}
					>
						<i className={`fa-solid ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`} aria-hidden="true"></i>
					</button>
				</>
			) : (
				<img src={photo.src} alt={photo.caption} loading="lazy" draggable={false} />
			)}
			<figcaption>{photo.album}</figcaption>
		</figure>
	);
};

export default PhotoWidget;
