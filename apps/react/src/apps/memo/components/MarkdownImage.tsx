import React, { useEffect, useState } from 'react';
import { resolveImageSrc } from '../posts';
import { CONTENT_IMAGES } from '../contentImages';

interface Props {
	src?: string;
	alt?: string;
	title?: string;
}

/**
 * 본문 이미지. 글 파일 기준 상대 경로를 빌드된 주소로 바꾸고, 본문 폭에 맞춰 보여준다.
 * `![설명](경로 "캡션")`의 캡션은 이미지 아래에 보여주고, 클릭하면 크게 본다.
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
			<button
				type="button"
				className="memo-image-button"
				aria-label={`${alt || '이미지'} 크게 보기`}
				onClick={() => setZoomed(true)}
			>
				<img src={resolved} alt={alt} loading="lazy" decoding="async" />
			</button>
			{title && <span className="memo-caption">{title}</span>}
			{zoomed && <Lightbox src={resolved} alt={alt} onClose={() => setZoomed(false)} />}
		</span>
	);
};

/** 이미지 크게 보기. 바깥을 클릭하거나 Esc를 누르면 닫힌다. */
const Lightbox: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);

	return (
		<span className="memo-lightbox" role="dialog" aria-modal="true" aria-label={alt || '이미지'} onClick={onClose}>
			<img src={src} alt={alt} />
		</span>
	);
};

export default MarkdownImage;
