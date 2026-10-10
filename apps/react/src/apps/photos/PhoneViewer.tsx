// 휴대폰 사진 크게 보기 (iOS 사진): 밀어서 넘기기, 띠, 정보·공유 막대
import { useEffect, useRef, useState } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu from '@/shared/ui/menu/Menu';
import { shareLink } from '@/shared/lib/appLink';
import { fileNameOf, formatBytes, formatOf, megapixels } from './albums';
import { CaptionField, Thumb, type Shown } from './PhotoParts';
import { captionOf, useCaptions } from './captionsApi';
import { useMoveDirection } from '@/shared/ui/motion/useMoveDirection';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import { keyOf } from './photosMobile.model';

const SWIPE_PX = 50;
const TAP_PX = 8;

/**
 * 크게 보기 (iOS 사진): 위에 뒤로 가기·제목 알약·•••, 가운데 사진, 아래에 사진 띠와 막대(공유 · 좋아요·정보 · 프로젝트 페이지).
 * 사진을 옆으로 밀거나 띠의 사진을 눌러 넘기고, ←·→ 키로도 넘긴다
 */
export const PhoneViewer = ({
	photos,
	index,
	liked,
	onToggleLike,
	onMove,
	onClose,
	onOpenProject,
}: {
	photos: Shown[];
	index: number;
	liked: boolean;
	onToggleLike: () => void;
	onMove: (index: number) => void;
	onClose: () => void;
	onOpenProject: (id: string) => void;
}) => {
	const photo = photos[index];
	const caption = captionOf(photo, useCaptions());
	const [info, setInfo] = useState(false);
	// 넘긴 쪽에서 사진이 밀려 들어오고(data-direction), 정보 판은 닫으면 아래로 내려가며 사라진다
	const direction = useMoveDirection(index, photos.length);
	const infoPanel = useExitMotion<HTMLElement>('panel-out-down');
	// 사진만 보기 (iOS 사진): 사진을 탭하면 다른 UI는 숨고 까만 바탕에 사진만. 다시 탭하면 돌아온다
	const [focus, setFocus] = useState(false);
	// 불러온 사진의 실제 크기와 파일 크기 (정보 판). 사진이 바뀌면 그 사진의 것으로
	const [measured, setMeasured] = useState<{ src: string; width: number; height: number; bytes: number | null } | null>(
		null
	);
	const measure = (width: number, height: number) => {
		const entry = performance.getEntriesByName(new URL(photo.src, location.href).href)[0] as
			PerformanceResourceTiming | undefined;
		const bytes = entry ? entry.encodedBodySize || entry.decodedBodySize || null : null;
		setMeasured({ src: photo.src, width, height, bytes });
	};
	const size = measured?.src === photo.src ? measured : null;
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);
	const strip = useRef<HTMLUListElement>(null);
	const swipe = useRef<{ x: number; y: number } | null>(null);
	const share = () => void shareLink({ app: 'safari', id: photo.album.id }, photo.album.name);

	const move = (delta: number) => onMove(Math.min(photos.length - 1, Math.max(0, index + delta)));

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'ArrowLeft') move(-1);
			else if (event.key === 'ArrowRight') move(1);
			else return;
			event.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// 사진 띠: 지금 사진이 가운데 오게 넘긴다
	useEffect(() => {
		strip.current
			?.querySelector<HTMLElement>('[aria-current="true"]')
			?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	}, [index]);

	return (
		<div
			className="photos-phone-viewer"
			role="dialog"
			aria-label={`사진 ${index + 1}/${photos.length}: ${caption}`}
			data-focus={focus || undefined}
		>
			<MobileNavigation backLabel="돌아가기" onBack={onClose} immersive={focus} />
			<div className="photos-phone-viewer-title">
				<strong>{photo.album.name}</strong>
				<span>{caption}</span>
			</div>
			<button
				ref={moreButton}
				type="button"
				className="photos-phone-viewer-more"
				aria-label="사진 동작"
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
				}}
			>
				<i className="fa-solid fa-ellipsis" aria-hidden="true" />
			</button>

			<div
				className={`photos-phone-stage ${info ? 'with-info' : ''}`}
				data-direction={direction ?? undefined}
				onPointerDown={(event) => (swipe.current = { x: event.clientX, y: event.clientY })}
				onPointerUp={(event) => {
					const start = swipe.current;
					swipe.current = null;
					if (!start) return;
					const dx = event.clientX - start.x;
					const dy = event.clientY - start.y;
					if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
					// 움직이지 않은 탭이면 사진만 보기를 켜고 끈다 (영상은 재생 단추를 눌러야 하니 영상 위의 탭은 빼고)
					else if (Math.hypot(dx, dy) < TAP_PX && !(event.target instanceof HTMLVideoElement)) {
						setInfo(false);
						setFocus(!focus);
					}
				}}
				onPointerCancel={() => (swipe.current = null)}
			>
				{photo.video ? (
					<video
						key={photo.src}
						src={photo.src}
						controls
						autoPlay
						muted
						playsInline
						onLoadedMetadata={(event) => measure(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
					/>
				) : (
					<img
						key={photo.src}
						src={photo.src}
						alt={caption}
						draggable={false}
						onLoad={(event) => measure(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
					/>
				)}
			</div>

			{/* 정보 (iOS 사진): 사진이 위로 줄고, 캡션 줄과 회색 판(기간·파일, 형식 카드, 프로젝트 페이지)이 아래에서 올라온다 */}
			{info && (
				<aside ref={infoPanel} className="photos-phone-info" aria-label="사진 정보">
					<CaptionField key={photo.src} photo={photo} className="photos-phone-caption" />
					<div className="photos-phone-info-panel">
						<h3>{photo.album.period ?? photo.album.name}</h3>
						<p className="photos-phone-file">
							<i className="fa-regular fa-file-image" aria-hidden="true" /> <span>{fileNameOf(photo.src)}</span>
						</p>
						<section className="photos-phone-card" aria-label="파일">
							<header>
								<strong>{photo.album.name}</strong>
								<span className="photos-phone-format">{formatOf(photo.src)}</span>
							</header>
							<p>
								프로젝트 {photo.video ? '영상' : '화면'} — {index + 1}번째
							</p>
							<p>
								{size
									? [
											megapixels(size.width, size.height),
											`${size.width} × ${size.height}`,
											size.bytes ? formatBytes(size.bytes) : null,
										]
											.filter(Boolean)
											.join(' · ')
									: '불러오는 중…'}
							</p>
							<ul className="photos-phone-stats">
								<li>{photo.video ? '영상' : '사진'}</li>
								<li>
									{index + 1}/{photos.length}
								</li>
								<li>앨범 {photo.album.photos.length}장</li>
							</ul>
						</section>
						<button type="button" className="photos-phone-info-action" onClick={() => onOpenProject(photo.album.id)}>
							{photo.album.name} 페이지 열기…
						</button>
					</div>
				</aside>
			)}

			<ul ref={strip} className={`photos-phone-strip ${info ? 'hidden' : ''}`} aria-label="사진 띠">
				{photos.map((item, at) => (
					<li key={keyOf(item)}>
						<button
							type="button"
							aria-label={`${at + 1}번째 사진: ${item.caption}`}
							aria-current={at === index || undefined}
							onClick={() => onMove(at)}
						>
							<Thumb photo={item} />
						</button>
					</li>
				))}
			</ul>

			<div className={`photos-phone-viewer-bar ${info ? 'over-info' : ''}`}>
				<button type="button" className="photos-phone-round" aria-label="공유" onClick={share}>
					<i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" />
				</button>
				<div className="photos-phone-pill">
					<button type="button" aria-label="좋아요" aria-pressed={liked} onClick={onToggleLike}>
						<i className={liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} aria-hidden="true" />
					</button>
					<button type="button" aria-label="정보" aria-pressed={info} onClick={() => setInfo(!info)}>
						<i className="fa-solid fa-info photos-phone-info-icon" aria-hidden="true" />
					</button>
				</div>
				{/* 오른쪽 자리는 비워 가운데 알약을 가운데에 둔다 (프로젝트 페이지는 정보와 ••• 에서 연다) */}
				<span className="photos-phone-bar-spacer" aria-hidden="true" />
			</div>

			{menu && (
				<Menu
					label="사진 동작"
					className="touch"
					anchor={menu}
					trigger={moreButton}
					onClose={() => setMenu(null)}
					items={[
						{ label: '공유', icon: 'fa-solid fa-arrow-up-from-bracket', onSelect: share },
						{
							label: liked ? '좋아요 취소' : '좋아요',
							icon: liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart',
							onSelect: onToggleLike,
						},
						{ label: '정보', icon: 'fa-solid fa-circle-info', onSelect: () => setInfo(true) },
						'separator',
						{
							label: `${photo.album.name} 페이지 열기`,
							icon: 'fa-regular fa-compass',
							onSelect: () => onOpenProject(photo.album.id),
						},
					]}
				/>
			)}
		</div>
	);
};
