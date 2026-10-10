// HYEONIVERSE 테마 프리셋 미리보기 (CreativePage가 직접 쓴다). 색 계산은 color.ts
import React, { useState, useEffect, useRef } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import type { ThemeSwatch } from '@/shared/profile';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { contrast, grade, readableAccent, textOnAccent } from './color';
import { useInView } from './useInView';
import './demos.css';

/** 홈의 3D 토러스: 색 프리셋과 상관없이 라이트·다크 두 벌뿐이라, 실제 홈 캡처에서 오려 낸 그림을 모드마다 쓴다 (돌리지 않는다) */
const TORUS = {
	light: '/imgs/projects/hyeoniverse/torus-light.webp',
	dark: '/imgs/projects/hyeoniverse/torus-dark.webp',
};
/** 프리셋이 혼자 넘어가는 간격 (ms), 몇 번 넘어갈 때마다 모드도 바꾸는지 */
const CYCLE_MS = 2200;
const FLIP_EVERY = 4;

/**
 * 테마 미리보기: 프리셋을 고르거나 라이트·다크를 바꾸면 작은 홈 화면의 색이 그 테마로 바뀐다.
 * 화면에 보이는 동안 프리셋이 혼자 넘어가고, 한 번이라도 직접 고르면 멈춘다
 */
export const Themes: React.FC<{ palette: ThemeSwatch[] }> = ({ palette }) => {
	const [box, inView] = useInView<HTMLDivElement>(0.4);
	const [index, setIndex] = useState(0);
	const [mode, setMode] = useState<'light' | 'dark'>('light');
	const [touched, setTouched] = useState(false);
	const ticks = useRef(0);

	useEffect(() => {
		if (!inView || touched || prefersReducedMotion()) return;
		const timer = window.setInterval(() => {
			ticks.current += 1;
			setIndex((now) => (now + 1) % palette.length);
			if (ticks.current % FLIP_EVERY === 0) setMode((now) => (now === 'light' ? 'dark' : 'light'));
		}, CYCLE_MS);
		return () => window.clearInterval(timer);
	}, [inView, touched, palette.length]);

	const theme = palette[index];
	const bg = mode === 'light' ? theme.lightBg : theme.darkBg;
	const text = mode === 'light' ? theme.lightText : theme.darkText;
	const onAccent = textOnAccent(theme, mode);
	const accentText = readableAccent(theme.accent, bg);
	const body = contrast(text, bg);
	const accent = contrast(accentText, bg);
	const button = contrast(onAccent, theme.accent);
	const torus = TORUS[mode];

	return (
		<div className="cd-themes" ref={box} data-reveal="">
			<div
				className="cd-site"
				data-mode={mode}
				style={cssVars({
					't-bg': bg,
					't-text': text,
					't-accent': theme.accent,
					't-on': onAccent,
					't-accent-text': accentText,
				})}
				aria-label={`${theme.name} 테마 ${mode === 'light' ? '라이트' : '다크'} 미리보기`}
				role="img"
			>
				<div className="cd-site-bar">
					<b>HYEONIVERSE</b>
					<span>Works</span>
					<span>Posts</span>
					<span>About</span>
					<i className={`fa-solid ${mode === 'light' ? 'fa-sun' : 'fa-moon'}`} />
				</div>
				<div className="cd-site-hero">
					<div>
						<small>Portfolio</small>
						<p>
							작업물과 글을,
							<br />
							움직이는 화면으로.
						</p>
						<span className="cd-site-button">작업물 보기</span>
					</div>
					<img className="cd-torus" src={torus} alt="" />
				</div>
				<div className="cd-site-cards">
					{['웹', '모바일 앱', '게임'].map((tag) => (
						<div key={tag}>
							<span className="cd-site-thumb" />
							<em>{tag}</em>
							<span className="cd-site-line" />
							<span className="cd-site-line short" />
						</div>
					))}
				</div>
			</div>
			<div className="cd-themes-side">
				<div className="cd-themes-top">
					<p className="cd-themes-name">{theme.name}</p>
					<div className="cd-seg" role="group" aria-label="모드">
						{(['light', 'dark'] as const).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={mode === value}
								onClick={() => {
									setTouched(true);
									setMode(value);
								}}
							>
								<i className={`fa-solid ${value === 'light' ? 'fa-sun' : 'fa-moon'}`} />{' '}
								{value === 'light' ? '라이트' : '다크'}
							</button>
						))}
					</div>
				</div>
				<ul className="cd-swatches" aria-label="테마 프리셋">
					{palette.map((swatch, i) => (
						<li key={swatch.name}>
							<button
								type="button"
								aria-pressed={i === index}
								title={swatch.name}
								aria-label={swatch.name}
								onClick={() => {
									setTouched(true);
									setIndex(i);
								}}
								style={cssVars({
									's-accent': swatch.accent,
									's-bg': mode === 'light' ? swatch.lightBg : swatch.darkBg,
								})}
							/>
						</li>
					))}
				</ul>
				<dl className="cd-themes-five">
					{(
						[
							['강조', theme.accent],
							['라이트 바탕', theme.lightBg],
							['라이트 글자', theme.lightText],
							['다크 바탕', theme.darkBg],
							['다크 글자', theme.darkText],
						] as const
					).map(([label, color]) => (
						<div key={label}>
							<dt>
								<i style={{ backgroundColor: color }} />
								{label}
							</dt>
							<dd>{color}</dd>
						</div>
					))}
				</dl>
				<ul className="cd-contrast" aria-label="대비 점검">
					<li data-grade={grade(body)}>
						본문 <b>{body.toFixed(1)}:1</b> <span>{grade(body)}</span>
					</li>
					<li data-grade={grade(accent)}>
						강조 글자 <b>{accent.toFixed(1)}:1</b>
						{accentText !== theme.accent && <small>명도 보정 {accentText}</small>}
						<span>{grade(accent)}</span>
					</li>
					<li data-grade={grade(button)}>
						강조 면 위 글자 <b>{button.toFixed(1)}:1</b> <span>{grade(button)}</span>
					</li>
				</ul>
				<p className="cd-hint">토러스는 프리셋을 바꿔도 그대로이고, 라이트·다크에서만 재질이 바뀝니다</p>
			</div>
		</div>
	);
};
