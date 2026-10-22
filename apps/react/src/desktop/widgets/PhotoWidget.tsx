import { useEffect, useMemo, useRef, useState } from 'react';
import { photosOf } from './photoSources';
import { usePhotoSources } from './usePhotoSources';

/** 사진을 넘기는 간격 (영상은 끝까지 재생한 뒤 넘긴다) */
const INTERVAL_MS = 10_000;

const isGif = (src: string) => /\.gif(\?|$)/i.test(src);

/** 위젯 위에 뜬 작은 유리 단추. 누를 때 위젯 끌기·앱 열기가 일어나지 않게 막는다 */
const ControlButton = ({
	label,
	pressed,
	icon,
	onClick,
}: {
	label: string;
	pressed: boolean;
	icon: string;
	onClick: () => void;
}) => (
	<button
		type="button"
		className="widget-photo-control"
		aria-label={label}
		aria-pressed={pressed}
		onPointerDown={(event) => event.stopPropagation()}
		onClick={onClick}
	>
		<i className={`fa-solid ${icon}`} aria-hidden="true"></i>
	</button>
);

/**
 * 고른 앨범이나 Finder › 그림의 폴더를 차례로 (고르지 않았거나 없어진 곳이면 모든 앨범).
 * 영상은 소리 없이 저절로 재생하고, 끝나면 다음으로 넘긴다.
 * 오른쪽 아래의 단추 둘은 늘 같은 자리에 있다: 일시 정지(영상은 멈추고, GIF는 지금 장면에서 멈추고, 넘기기도 멈춘다)와 소리
 */
const PhotoWidget = ({ album }: { album?: string }) => {
	const sources = usePhotoSources();
	const photos = useMemo(() => photosOf(sources, album), [sources, album]);
	const [index, setIndex] = useState(0);
	const [muted, setMuted] = useState(true);
	const [paused, setPaused] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const imageRef = useRef<HTMLImageElement>(null);
	const frameRef = useRef<HTMLCanvasElement>(null);
	const photo = photos.length ? photos[index % photos.length] : undefined;
	const next = () => setIndex((value) => value + 1);
	const video = photo?.video === true;
	const gif = !video && photo !== undefined && isGif(photo.src);

	// 그림은 시간마다 넘기고, 영상은 onEnded가 넘긴다. 일시 정지 중에는 넘기지 않는다
	useEffect(() => {
		if (video || paused) return;
		const timer = window.setTimeout(() => setIndex((value) => value + 1), INTERVAL_MS);
		return () => window.clearTimeout(timer);
	}, [video, paused, index]);

	// 영상: 일시 정지·재생을 영상에 그대로
	useEffect(() => {
		const element = videoRef.current;
		if (!element) return;
		if (paused) element.pause();
		else void element.play().catch(() => {});
	}, [paused, photo?.src]);

	// GIF는 멈출 수 없으므로, 멈출 때 지금 장면을 캔버스에 옮겨 그 위에 덮는다
	useEffect(() => {
		const image = imageRef.current;
		const canvas = frameRef.current;
		if (!gif || !paused || !image || !canvas || !image.naturalWidth) return;
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		canvas.getContext('2d')?.drawImage(image, 0, 0);
	}, [gif, paused, photo?.src]);

	if (!photo) return <p className="widget-note">사진이 없습니다</p>;
	return (
		<figure className="widget-photo-body">
			{video ? (
				<video
					ref={videoRef}
					key={photo.src}
					src={photo.src}
					aria-label={photo.caption}
					autoPlay={!paused}
					muted={muted}
					playsInline
					// 영상 하나뿐이면 끝없이 되풀이하고, 여럿이면 끝나면 다음으로
					loop={photos.length === 1}
					onEnded={next}
					draggable={false}
				/>
			) : (
				<img ref={imageRef} src={photo.src} alt={photo.caption} loading="lazy" draggable={false} />
			)}
			{gif && paused && <canvas ref={frameRef} className="widget-photo-frame" aria-hidden="true" />}
			<div className="widget-photo-controls">
				<ControlButton
					label={paused ? '재생' : '일시 정지'}
					pressed={paused}
					icon={paused ? 'fa-play' : 'fa-pause'}
					onClick={() => setPaused((value) => !value)}
				/>
				{/* 소리는 영상에만 쓰이지만, 그림일 때 사라지면 헷갈려서 늘 둔다. 고른 값은 다음 영상에도 그대로 */}
				<ControlButton
					label={muted ? '소리 켜기' : '소리 끄기'}
					pressed={!muted}
					icon={muted ? 'fa-volume-xmark' : 'fa-volume-low'}
					onClick={() => setMuted((value) => !value)}
				/>
			</div>
			<figcaption>{photo.album}</figcaption>
		</figure>
	);
};

export default PhotoWidget;
