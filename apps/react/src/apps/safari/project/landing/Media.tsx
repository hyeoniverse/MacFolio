// 그림·영상 한 장, 그리고 그림이 없는 항목의 비주얼. 다크 테마 그림이 있으면 사이트가 다크일 때 그것을 보인다 (landing.css)
import React from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { iconOf, type LandingMedia, type LandingPoint } from './content';

export const Media: React.FC<{ media: LandingMedia; className?: string; eager?: boolean; decorative?: boolean }> = ({
	media,
	className,
	eager = false,
	decorative = false,
}) => {
	const alt = decorative ? '' : media.alt;
	const cls = ['lk-media', className].filter(Boolean).join(' ');
	if (media.kind === 'video')
		return (
			<video
				className={cls}
				src={media.src}
				muted
				loop
				playsInline
				autoPlay={!prefersReducedMotion()}
				controls={prefersReducedMotion()}
				aria-label={alt || undefined}
				aria-hidden={decorative || undefined}
			/>
		);
	if (!media.dark) return <img className={cls} src={media.src} alt={alt} loading={eager ? 'eager' : 'lazy'} />;
	// 라이트·다크 두 장: 지금 테마에 맞는 한 장만 보인다 (CSS)
	return (
		<span className={`${cls} lk-media-pair`}>
			<img className="lk-media-light" src={media.src} alt={alt} loading={eager ? 'eager' : 'lazy'} />
			<img className="lk-media-dark" src={media.dark} alt="" aria-hidden="true" loading="lazy" />
		</span>
	);
};

/** 그림이 없는 항목의 비주얼: 아이콘 하나와 항목 제목을 담은 차분한 면 (장식) */
export const PointArt: React.FC<{ point: LandingPoint; index: number; className?: string }> = ({
	point,
	index,
	className,
}) => (
	<div className={['lk-art', className].filter(Boolean).join(' ')} aria-hidden="true">
		<span className="lk-art-icon">
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</span>
		<span className="lk-art-title">{point.title}</span>
	</div>
);

/** 항목의 대표 비주얼: 첫 그림(영상), 없으면 PointArt */
export const PointVisual: React.FC<{ point: LandingPoint; index: number; className?: string }> = ({
	point,
	index,
	className,
}) =>
	point.media[0] ? (
		<Media media={point.media[0]} className={className} />
	) : (
		<PointArt point={point} index={index} className={className} />
	);
