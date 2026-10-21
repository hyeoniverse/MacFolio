import { useEffect, useMemo, useState } from 'react';
import { ALBUMS } from '@/apps/photos/albums';

/** 사진을 넘기는 간격 */
const INTERVAL_MS = 10_000;

/** 사진 앱의 프로젝트 화면을 차례로 (영상·SVG는 뺀다) */
const PhotoWidget = () => {
	const photos = useMemo(
		() =>
			ALBUMS.flatMap((album) =>
				album.photos
					.filter((photo) => !photo.video && !/\.svg$/i.test(photo.src))
					.map((photo) => ({ ...photo, album: album.name }))
			),
		[]
	);
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
