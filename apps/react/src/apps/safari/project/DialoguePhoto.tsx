// RPG 대화창(DialoguePage)의 그림: 주제의 그림·영상, 메뉴 미리보기, 엔딩 앨범, 크게 보기.
// 게임 화면은 정수 배(zoom)로 키운 픽셀 판이라 그 안에 사진을 두면 사진까지 두세 배로 커져 흐려진다. 그래서 그림은 게임 화면
// 밖(.dl 바로 아래)의 판에 실제 px 그대로 띄운다: 무대 자리(게임 화면 안 빈 자리 .dl-photo-slot의 실제 px 사각형) 가운데에
// 비율을 지켜 가장 크게, 원래 크기의 1.5배를 넘지 않게(fitPhoto), 부드럽게(image-rendering: auto). 액자는 흰 테두리와
// 옅은 그림자, 아래 줄에 넘기기(◀ 1 / 4 ▶)와 이름. 그림을 누르면 Safari 페이지 전체를 덮는 크게 보기가 열린다(Esc·X로 닫는다)
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { fitPhoto, type Box, type Slide } from '@/apps/safari/project/dialogueStage';

/** 액자 테두리 (실제 px) */
const BORDER = 3;

/** 그림·영상의 원래 크기를 잰다 (받기 전이면 null). 이미 받아 둔 그림은 바로 */
function useNatural(src: string) {
	const [size, setSize] = useState<{ src: string; w: number; h: number } | null>(null);
	const note = (w: number, h: number) => {
		if (w > 0 && h > 0) setSize((prev) => (prev?.src === src && prev.w === w && prev.h === h ? prev : { src, w, h }));
	};
	return { natural: size?.src === src ? size : null, note };
}

/** 그림 한 장 (영상은 소리 없이 반복). 크기를 알면 그 크기로, 모르면 자리에 들어가게 줄여 받기만 한다 */
const Media: React.FC<{
	slide: Slide;
	size: { w: number; h: number } | null;
	max: { w: number; h: number };
	onNatural: (w: number, h: number) => void;
	controls?: boolean;
}> = ({ slide, size, max, onNatural, controls }) => {
	const imgRef = useRef<HTMLImageElement>(null);
	// 이미 받아 둔 그림은 load가 오기 전에 크기를 안다
	useLayoutEffect(() => {
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth > 0) onNatural(img.naturalWidth, img.naturalHeight);
	});
	const style: React.CSSProperties = size
		? { width: size.w, height: size.h }
		: { maxWidth: Math.max(1, max.w), maxHeight: Math.max(1, max.h), opacity: 0 };
	return slide.video ? (
		<video
			src={slide.src}
			muted
			loop
			playsInline
			controls={controls}
			autoPlay={!prefersReducedMotion()}
			preload="metadata"
			style={style}
			onLoadedMetadata={(e) => onNatural(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
		/>
	) : (
		<img
			ref={imgRef}
			src={slide.src}
			alt={slide.caption ?? ''}
			style={style}
			onLoad={(e) => onNatural(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
		/>
	);
};

/** 넘기기: ◀ 1 / 4 ▶ (읽기 프로그램에는 '그림 1 / 4') */
const Flip: React.FC<{ index: number; count: number; onFlip: (step: number) => void }> = ({ index, count, onFlip }) => (
	<span className="dl-photo-flip">
		<button type="button" aria-label="이전 그림" onClick={() => onFlip(-1)}>
			◀
		</button>
		<span className="dl-photo-count" aria-live="polite">
			<span className="visually-hidden">그림 </span>
			{`${index + 1} / ${count}`}
		</span>
		<button type="button" aria-label="다음 그림" onClick={() => onFlip(1)}>
			▶
		</button>
	</span>
);

/**
 * 무대의 그림 한 장: box(실제 px, .dl 기준) 가운데에 액자. 아래 줄(넘기기, 이름)이 있으면 그만큼 빼고 가장 크게.
 * interactive가 아니면(메뉴 미리보기) 누를 수 없고 읽기 프로그램에도 숨긴다
 */
export const DialoguePhoto: React.FC<{
	box: Box;
	zoom: number;
	slides: Slide[];
	index: number;
	caption?: string;
	interactive?: boolean;
	onFlip?: (step: number) => void;
	onOpen?: () => void;
}> = ({ box, zoom, slides, index, caption, interactive = false, onFlip, onOpen }) => {
	const slide = slides[index];
	const { natural, note } = useNatural(slide?.src ?? '');
	if (!slide || box.w < 40 || box.h < 40) return null;
	const flips = interactive && onFlip && slides.length > 1;
	const foot = flips || Boolean(caption);
	// 아래 줄: 글 한 줄(16)과 위 틈(4)을 실제 px로. 글은 많아야 두 배(22px)라 그림 자리를 덜 먹는다
	const textZoom = Math.min(zoom, 2);
	const footH = foot ? Math.round(20 * textZoom) : 0;
	const max = { w: box.w - 2 * BORDER, h: box.h - footH - 2 * BORDER };
	const size = natural ? fitPhoto(natural.w, natural.h, max.w, max.h) : null;
	return (
		<div
			className="dl-photo"
			data-interactive={interactive || undefined}
			style={{ left: box.x, top: box.y, width: box.w, height: box.h, ['--dl-z' as string]: textZoom }}
			aria-hidden={interactive ? undefined : 'true'}
			inert={!interactive}
		>
			<figure className="dl-photo-figure">
				<button
					type="button"
					className="dl-photo-frame"
					data-natural={natural ? `${natural.w}x${natural.h}` : undefined}
					aria-label={`${caption || slide.caption || '그림'} 크게 보기`}
					onClick={onOpen}
					tabIndex={interactive ? undefined : -1}
				>
					<Media key={slide.src} slide={slide} size={size} max={max} onNatural={note} />
				</button>
				{foot && (
					<figcaption className="dl-photo-foot" style={{ height: Math.round(16 * textZoom) }}>
						{flips && <Flip index={index} count={slides.length} onFlip={onFlip} />}
						{caption && <span className="dl-photo-caption">{caption}</span>}
					</figcaption>
				)}
			</figure>
		</div>
	);
};

/** 엔딩의 앨범: 그림 몇 장을 한 줄로 (각 칸에 들어가게 줄이기만 한다). 꾸밈이라 읽기 프로그램에는 숨긴다 */
export const PhotoAlbum: React.FC<{ box: Box; slides: Slide[] }> = ({ box, slides }) => {
	if (box.w < 40 || box.h < 40 || slides.length === 0) return null;
	const gap = 16;
	const cellW = Math.floor((box.w - gap * (slides.length - 1)) / slides.length) - 2 * BORDER;
	return (
		<div
			className="dl-photo dl-photo-album"
			style={{ left: box.x, top: box.y, width: box.w, height: box.h, gap }}
			aria-hidden="true"
			inert
		>
			{slides.map((slide) => (
				<span key={slide.src} className="dl-photo-frame">
					<img src={slide.src} alt="" style={{ maxWidth: cellW, maxHeight: box.h - 2 * BORDER }} />
				</span>
			))}
		</div>
	);
};

/**
 * 크게 보기: Safari 페이지 전체를 덮는 짙은 막 위에 그림 한 장을 원래 크기까지(키우지 않는다). 오른쪽 위 닫기, 아래 넘기기와 이름.
 * 열리면 닫기 단추에 포커스, 닫히면 연 단추로 돌려준다. 키(Esc·X 닫기, ←·→ 넘기기)는 DialoguePage가 받는다
 */
export const Lightbox: React.FC<{
	slides: Slide[];
	index: number;
	caption?: string;
	onFlip: (step: number) => void;
	onClose: () => void;
}> = ({ slides, index, caption, onFlip, onClose }) => {
	const closeRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		closeRef.current?.focus({ preventScroll: true });
		return () => opener?.focus({ preventScroll: true });
	}, []);
	const slide = slides[index];
	if (!slide) return null;
	return (
		<div className="dl-lightbox" role="dialog" aria-modal="true" aria-label="그림 크게 보기" onClick={onClose}>
			<button ref={closeRef} type="button" className="dl-lightbox-close" onClick={onClose}>
				<kbd aria-hidden="true">X</kbd>
				닫기
			</button>
			<figure className="dl-lightbox-figure" onClick={(e) => e.stopPropagation()}>
				{slide.video ? (
					<video key={slide.src} src={slide.src} muted loop playsInline controls autoPlay={!prefersReducedMotion()} />
				) : (
					<img key={slide.src} src={slide.src} alt={caption || slide.caption || ''} />
				)}
				{(slides.length > 1 || caption) && (
					<figcaption className="dl-lightbox-foot">
						{slides.length > 1 && <Flip index={index} count={slides.length} onFlip={onFlip} />}
						{caption && <span className="dl-photo-caption">{caption}</span>}
					</figcaption>
				)}
			</figure>
		</div>
	);
};
