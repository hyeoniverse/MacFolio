import { cssVars } from '@/shared/lib/cssVars';
// HYEONIVERSE 페이지의 그림과 놀잇거리: 스크롤하면 넘어가는 화면, 라이트·다크를 밀대로 나눠 보는 그림, 레이아웃 도식,
// 화면에 보일 때만 도는 영상, 줄어드는 전후 막대, 스크롤하면 펼쳐지는 토큰 세 층
import React, { useEffect, useRef, useState } from 'react';
import type { ProjectChapter, ProjectPoint } from '@/shared/profile';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/CreativeParts.css';

/** 밀대가 혼자 한 번 흔들리는 데 걸리는 시간과, 다음 흔들림까지 쉬는 시간 (ms) */
const SWAY_MS = 2400;
const SWAY_REST_MS = 3200;

/**
 * 같은 화면의 라이트와 다크: 가운데 손잡이를 끌면(또는 방향키) 왼쪽은 라이트, 오른쪽은 다크로 나뉜다.
 * 끌 수 있다는 걸 알리려고, 화면에 보이는 동안 손잡이가 혼자 좌우로 흔들렸다 돌아온다. 한 번이라도 직접 만지면 멈춘다
 */
export const Compare: React.FC<{ light: string; dark: string; alt: string }> = ({ light, dark, alt }) => {
	const [split, setSplit] = useState(50);
	const [touched, setTouched] = useState(false);
	const [swaying, setSwaying] = useState(false);
	const box = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = box.current;
		if (!node || touched || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
		let frame = 0;
		let timer = 0;
		const sway = () => {
			const start = performance.now();
			setSwaying(true);
			const step = (now: number) => {
				const t = Math.min(1, (now - start) / SWAY_MS);
				// 50 → 왼쪽 → 오른쪽 → 50, 끝으로 갈수록 잦아든다
				setSplit(50 + Math.sin(t * Math.PI * 2) * 24 * (1 - t * 0.35));
				if (t < 1) frame = requestAnimationFrame(step);
				else {
					setSplit(50);
					setSwaying(false);
					timer = window.setTimeout(sway, SWAY_REST_MS);
				}
			};
			frame = requestAnimationFrame(step);
		};
		const stop = () => {
			cancelAnimationFrame(frame);
			window.clearTimeout(timer);
			setSwaying(false);
		};
		const observer = new IntersectionObserver(([entry]) => {
			stop();
			if (entry.isIntersecting) timer = window.setTimeout(sway, 600);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			stop();
		};
	}, [touched]);

	const take = () => {
		if (!touched) setTouched(true);
	};

	return (
		<div
			className="cr-compare"
			ref={box}
			data-swaying={swaying || undefined}
			data-touched={touched || undefined}
			style={cssVars({ split: `${split}%` })}
		>
			<img src={light} alt={`${alt} (라이트)`} loading="lazy" />
			<img src={dark} alt={`${alt} (다크)`} loading="lazy" className="cr-compare-dark" />
			<span className="cr-compare-handle" aria-hidden="true">
				<i className="fa-solid fa-left-right" />
			</span>
			<span className="cr-compare-hint" aria-hidden="true">
				끌어서 비교해 보세요
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
				value={Math.round(split)}
				onPointerDown={take}
				onKeyDown={take}
				onChange={(event) => {
					take();
					setSplit(Number(event.target.value));
				}}
				aria-label="라이트와 다크를 나누는 위치"
			/>
		</div>
	);
};

/**
 * 스크롤 장면: 페이지를 내려가며 찍은 화면 여러 장. 그림이 화면 가운데에 붙어 있는 동안(트랙을 지나는 동안)
 * 스크롤한 만큼 다음 화면으로 넘어가고, 다 넘어가면 다시 흘러간다. 오른쪽 막대가 지금 어디쯤인지 보여 준다
 */
export const ScrollFrames: React.FC<{ frames: string[]; title: string }> = ({ frames, title }) => {
	const track = useRef<HTMLDivElement>(null);
	const box = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = track.current;
		const frame = box.current;
		if (!node || !frame) return;
		if (prefersReducedMotion()) {
			frame.style.setProperty('--p', '0');
			return;
		}
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const height = frame.offsetHeight;
			// 그림은 화면 가운데에 붙고(화면보다 크면 위를 넘친다), 트랙은 그림 높이 + 장마다 화면 절반만큼 길다
			const stick = Math.round((view.height - height) / 2);
			const travel = Math.round(view.height * 0.5 * (frames.length - 1));
			node.style.setProperty('--stick', `${stick}px`);
			node.style.height = `${height + travel}px`;
			const p = Math.min(1, Math.max(0, (view.top + stick - node.getBoundingClientRect().top) / travel));
			frame.style.setProperty('--p', p.toFixed(4));
			const at = p * (frames.length - 1);
			frame.querySelectorAll<HTMLElement>('img').forEach((img, i) => {
				img.style.opacity = String(Math.max(0, 1 - Math.abs(at - i)));
				img.style.transform = `translateY(${((i - at) * 8).toFixed(2)}%)`;
			});
		});
	}, [frames.length]);
	return (
		<div className="cr-scrolltrack" ref={track}>
			<figure className="cr-feature-media cr-scrollstick">
				<div className="cr-scrollframes" ref={box}>
					{frames.map((src, i) => (
						<img key={src} src={src} alt={i === 0 ? `${title}: 스크롤하며 넘어가는 화면` : ''} />
					))}
					<span className="cr-scrollframes-bar" aria-hidden="true">
						<i />
					</span>
					<span className="cr-scrollframes-hint" aria-hidden="true">
						<i className="fa-solid fa-computer-mouse" /> 스크롤하면 화면이 따라 움직입니다
					</span>
				</div>
			</figure>
		</div>
	);
};

/** 레이아웃 도식마다 그리는 조각 수 (카드, 층, 배경 등) */
const LAYOUT_PARTS: Record<string, number> = { flow: 10, grid: 6, cylinder: 8, fullscreen: 3, cinematic: 3, split: 8 };

/**
 * 갈래 여러 개를 작은 움직이는 도식으로: 레이아웃마다 실제로 어떻게 움직이는지(가로로 흐름, 벤토 칸, 도는 원통,
 * 겹쳐 바뀌는 배경과 HUD, 층마다 다른 속도, 멈춘 왼쪽과 흐르는 오른쪽)를 CSS로만 그린다
 */
const Layouts: React.FC<{ variants: NonNullable<ProjectPoint['variants']> }> = ({ variants }) => (
	<ul className="cr-layouts">
		{variants.map((variant, i) => {
			const kind = variant.label.toLowerCase();
			return (
				<li key={variant.label} style={cssVars({ d: i % 3 })}>
					<div className="cr-lay" data-kind={kind} aria-hidden="true">
						{kind === 'split' && <b />}
						<span className="cr-lay-stage">
							{Array.from({ length: LAYOUT_PARTS[kind] ?? 4 }, (_, part) => (
								<i key={part} style={cssVars({ i: part })} />
							))}
						</span>
						{kind === 'fullscreen' &&
							['LOC', 'TIME', 'FPS', 'WORKS'].map((corner) => (
								<em key={corner} data-corner={corner}>
									{corner}
								</em>
							))}
					</div>
					<strong>{variant.label}</strong>
					<span>{variant.note}</span>
				</li>
			);
		})}
	</ul>
);

/** 눌러서 크게 보는 그림: 작게 보이던 관리자 화면 캡처를 화면 가득 펼쳐 본다 (바깥을 누르거나 Esc로 닫는다) */
export const ZoomImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
	const dialog = useRef<HTMLDialogElement>(null);
	return (
		<>
			<button
				type="button"
				className="cr-zoom"
				onClick={() => dialog.current?.showModal()}
				aria-label={`${alt} 크게 보기`}
			>
				<img src={src} alt={alt} loading="lazy" />
				<span className="cr-zoom-hint" aria-hidden="true">
					<i className="fa-solid fa-magnifying-glass-plus" />
				</span>
			</button>
			<dialog
				ref={dialog}
				className="cr-zoom-dialog"
				aria-label={alt}
				onClick={(event) => {
					if (event.target === event.currentTarget) dialog.current?.close();
				}}
			>
				<img src={src} alt={alt} />
				<button type="button" onClick={() => dialog.current?.close()} aria-label="닫기">
					<i className="fa-solid fa-xmark" aria-hidden="true" />
				</button>
			</dialog>
		</>
	);
};

/** 화면에 보일 때만 도는 짧은 영상 (소리 없음, 움직임 줄이기면 멈춘 첫 화면) */
export const Clip: React.FC<{ src: string; label: string }> = ({ src, label }) => {
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
	if (point.variants) return <Layouts variants={point.variants} />;
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
				<li key={row.label} style={cssVars({ r: ratio })}>
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
