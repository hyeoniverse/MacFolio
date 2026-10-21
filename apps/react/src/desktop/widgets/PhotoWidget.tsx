import { useEffect, useMemo, useState } from 'react';
import { ALBUMS } from '@/apps/photos/albums';

/** 사진을 넘기는 간격 */
const INTERVAL_MS = 10_000;

/** 사진 앱의 앨범을 차례로 (album이 없거나 없어진 앨범이면 모든 앨범). 영상·SVG는 뺀다 */
const PhotoWidget = ({ album }: { album?: string }) => {
	const photos = useMemo(
		() =>
			(ALBUMS.some((item) => item.id === album) ? ALBUMS.filter((item) => item.id === album) : ALBUMS).flatMap((item) =>
				item.photos
					.filter((photo) => !photo.video && !/\.svg$/i.test(photo.src))
					.map((photo) => ({ ...photo, album: item.name }))
			),
		[album]
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
