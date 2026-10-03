// HYEONIVERSE 페이지의 그림과 놀잇거리: 라이트·다크를 밀대로 나눠 보는 그림, 골라 바꿔 보는 레이아웃,
// 화면에 보일 때만 도는 영상, 줄어드는 전후 막대, 스크롤하면 펼쳐지는 토큰 세 층
import React, { useEffect, useRef, useState } from 'react';
import type { ProjectChapter, ProjectPoint } from '@/shared/profile';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';

/** 같은 화면의 라이트와 다크: 가운데 손잡이를 끌면(또는 방향키) 왼쪽은 라이트, 오른쪽은 다크로 나뉜다 */
export const Compare: React.FC<{ light: string; dark: string; alt: string }> = ({ light, dark, alt }) => {
	const [split, setSplit] = useState(50);
	return (
		<div className="cr-compare" style={{ '--split': `${split}%` } as React.CSSProperties}>
			<img src={light} alt={`${alt} (라이트)`} loading="lazy" />
			<img src={dark} alt={`${alt} (다크)`} loading="lazy" className="cr-compare-dark" />
			<span className="cr-compare-handle" aria-hidden="true">
				<i className="fa-solid fa-left-right" />
			</span>
			<span className="cr-compare-tag light" aria-hidden="true">
				Light
			</span>
			<span className="cr-compare-tag dark" aria-hidden="true">
				Dark
			</span>
			<input
				type="range"
				min={0}
				max={100}
				value={split}
				onChange={(event) => setSplit(Number(event.target.value))}
				aria-label="라이트와 다크를 나누는 위치"
			/>
		</div>
	);
};

/** 골라 바꿔 보는 그림: 단추를 누르면 그 그림으로 겹쳐 바뀐다 */
const Variants: React.FC<{ variants: NonNullable<ProjectPoint['variants']>; title: string }> = ({
	variants,
	title,
}) => {
	const [current, setCurrent] = useState(0);
	return (
		<div className="cr-variants">
			<div className="cr-variants-tabs" role="group" aria-label={`${title} 고르기`}>
				{variants.map((variant, i) => (
					<button key={variant.label} type="button" aria-pressed={i === current} onClick={() => setCurrent(i)}>
						{variant.label}
					</button>
				))}
			</div>
			<div className="cr-variants-view">
				{variants.map((variant, i) => (
					<img
						key={variant.label}
						src={variant.image}
						alt={`${title}: ${variant.label}`}
						data-on={i === current}
						loading="lazy"
					/>
				))}
			</div>
		</div>
	);
};

/** 화면에 보일 때만 도는 짧은 영상 (소리 없음, 움직임 줄이기면 멈춘 첫 화면) */
const Clip: React.FC<{ src: string; label: string }> = ({ src, label }) => {
	const video = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		const node = video.current;
		if (!node || typeof IntersectionObserver === 'undefined') return;
		if (prefersReducedMotion()) return;
		const observer = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) void node.play().catch(() => undefined);
			else node.pause();
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	// 첫 화면 그림(같은 이름의 .jpg)을 미리 보여 준다 (영상을 못 트는 브라우저에서도 빈칸이 아니게)
	const poster = src.replace(/\.mp4$/, '.jpg');
	return <video ref={video} src={src} poster={poster} aria-label={label} muted loop playsInline preload="metadata" />;
};

/** 기능 하나에 붙는 화면: 영상, 레이아웃 고르기, 라이트·다크 밀대, 그림 중 하나 */
export const FeatureMedia: React.FC<{ point: ProjectPoint }> = ({ point }) => {
	if (point.video) return <Clip src={point.video} label={`${point.title} 화면 녹화`} />;
	if (point.variants) return <Variants variants={point.variants} title={point.title} />;
	if (point.image && point.imageDark) return <Compare light={point.image} dark={point.imageDark} alt={point.title} />;
	if (point.image) return <img src={point.image} alt={`${point.title} 화면`} loading="lazy" />;
	return null;
};

/** 전후 막대: 화면에 들어오면 뒤 막대가 앞 막대 길이에서 줄어든다 */
export const Bars: React.FC<{ rows: NonNullable<ProjectChapter['compare']> }> = ({ rows }) => (
	<ul className="cr-bars" data-reveal="" aria-label="개선 전후">
		{rows.map((row) => {
			const ratio = row.after / row.before;
			return (
				<li key={row.label} style={{ '--r': ratio } as React.CSSProperties}>
					<span className="cr-bars-label">{row.label}</span>
					<span className="cr-bars-track before" aria-hidden="true">
						<i />
					</span>
					<span className="cr-bars-value before">
						{row.before}
						{row.unit}
					</span>
					<span className="cr-bars-track after" aria-hidden="true">
						<i />
					</span>
					<span className="cr-bars-value after">
						{row.after}
						{row.unit}
						<em>−{Math.round((1 - ratio) * 100)}%</em>
					</span>
				</li>
			);
		})}
	</ul>
);

/**
 * 겹친 층: 처음엔 카드 세 장이 포개져 있다가, 층 묶음이 화면 아래에서 가운데쯤 올라오는 동안(--s 0→1)
 * 위에서부터 펼쳐지며 참조 화살표가 이어진다. 다시 올리면 포개진다
 */
export const Layers: React.FC<{ layers: NonNullable<ProjectChapter['layers']> }> = ({ layers }) => {
	const list = useRef<HTMLOListElement>(null);
	useEffect(() => {
		const node = list.current;
		if (!node) return;
		// 움직임 줄이기면 처음부터 펼쳐 둔다
		if (prefersReducedMotion()) {
			node.style.setProperty('--s', '1');
			return;
		}
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const top = node.getBoundingClientRect().top;
			const spread = (view.top + view.height * 0.8 - top) / (view.height * 0.35);
			node.style.setProperty('--s', Math.min(1, Math.max(0, spread)).toFixed(3));
		});
	}, []);
	return (
		<ol className="cr-layers" aria-label="토큰 층" ref={list}>
			{layers.map((layer, i) => (
				<li key={layer.name} style={{ '--i': i } as React.CSSProperties}>
					<span className="cr-layers-name">{layer.name}</span>
					<code>{layer.code}</code>
					<p>{layer.note}</p>
				</li>
			))}
		</ol>
	);
};
