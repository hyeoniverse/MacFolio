import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { captionParts, resolveImageSrc } from '@macfolio/desktop-core/memo';
import { CONTENT_IMAGES } from '../contentImages';
import { downloadImage } from '../download';

interface Props {
	src?: string;
	alt?: string;
	title?: string;
}

/**
 * 본문 이미지. 글 파일 기준 상대 경로를 빌드된 주소로 바꾸고, 본문 폭에 맞춰 보여준다.
 * `![설명](경로 "캡션")`의 캡션은 이미지 아래에 보여주고(캡션 안의 [글자](주소)는 링크), 클릭하면 크게 본다.
 * react-markdown은 이미지를 <p> 안에 넣으므로 <figure> 대신 <span>으로 감싼다.
 */
const MarkdownImage: React.FC<Props> = ({ src, alt = '', title }) => {
	const [zoomed, setZoomed] = useState(false);
	const resolved = resolveImageSrc(src, CONTENT_IMAGES);

	if (!resolved) {
		if (import.meta.env.DEV) console.warn(`[memo] 이미지를 찾을 수 없습니다: ${src}`);
		return <span className="memo-image-missing">이미지를 찾을 수 없습니다{alt && `: ${alt}`}</span>;
	}

	return (
		<span className="memo-figure">
			<span className="memo-figure-frame">
				<button
					type="button"
					className="memo-image-button"
					aria-label={`${alt || '이미지'} 크게 보기`}
					onClick={() => setZoomed(true)}
				>
					<img src={resolved} alt={alt} loading="lazy" decoding="async" />
				</button>
				<button
					type="button"
					className="memo-overlay-button memo-figure-download"
					aria-label="이미지 내려받기"
					title="이미지 내려받기"
					onClick={() => void downloadImage(resolved, alt)}
				>
					<i className="fa-solid fa-arrow-down" aria-hidden="true" />
				</button>
			</span>
			{title && (
				<span className="memo-caption">
					{captionParts(title).map((part, index) =>
						part.href ? (
							<a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
								{part.text}
							</a>
						) : (
							<React.Fragment key={index}>{part.text}</React.Fragment>
						)
					)}
				</span>
			)}
			{zoomed && <Lightbox src={resolved} alt={alt} onClose={() => setZoomed(false)} />}
		</span>
	);
};

/**
 * 이미지 크게 보기. 바깥을 클릭하거나 Esc를 누르면 닫힌다.
 * body에 그린다: 메모 레이아웃이 컨테이너 쿼리를 쓰면 그 안의 position: fixed가 창 기준이 되기 때문이다.
 */
const Lightbox: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			onClose();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);
	// 닫히면 흐려지며 사라진다
	const lightbox = useExitMotion<HTMLDivElement>('fade-out');

	return createPortal(
		<div
			ref={lightbox}
			className="memo-lightbox"
			role="dialog"
			aria-modal="true"
			aria-label={alt || '이미지'}
			onClick={onClose}
		>
			<img src={src} alt={alt} />
		</div>,
		document.body
	);
};

export default MarkdownImage;
