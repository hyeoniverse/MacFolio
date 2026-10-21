import { useEffect, useMemo, useState } from 'react';
import { photosOf } from './photoSources';
import { usePhotoSources } from './usePhotoSources';

/** 사진을 넘기는 간격 */
const INTERVAL_MS = 10_000;

/** 고른 앨범이나 Finder › 그림의 폴더를 차례로 (고르지 않았거나 없어진 곳이면 모든 앨범) */
const PhotoWidget = ({ album }: { album?: string }) => {
	const sources = usePhotoSources();
	const photos = useMemo(() => photosOf(sources, album), [sources, album]);
	const [index, setIndex] = useState(0);
	useEffect(() => {
		const timer = window.setInterval(() => setIndex((value) => value + 1), INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, []);
	const photo = photos.length ? photos[index % photos.length] : undefined;
	if (!photo) return <p className="widget-note">사진이 없습니다</p>;
	return (
		<figure className="widget-photo-body">
			<img src={photo.src} alt={photo.caption} loading="lazy" draggable={false} />
			<figcaption>{photo.album}</figcaption>
		</figure>
	);
};

export default PhotoWidget;
